/*
 * Copyright 2014 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
**/
import $ from 'jquery';
import _ from 'underscore';
import i18n from 'i18n';
import Backbone from 'backbone';
import React from 'react';
import ReactDOM from 'react-dom';
import utils from 'utils';
import models from 'models';
import dispatcher from 'dispatcher';
import {Input, Popover, Tooltip, ProgressButton} from 'views/controls';
import {DeleteNodesDialog} from 'views/dialogs';
import {backboneMixin, pollingMixin, dispatcherMixin, unsavedChangesMixin} from 'component_mixins';
import Node from 'views/cluster_page_tabs/nodes_tab_screens/node';
import {Sorter, Filter} from 'views/cluster_page_tabs/nodes_tab_screens/node_list_screen_objects';

var NodeListScreen, MultiSelectControl, NumberRangeControl, ManagementPanel,
  NodeLabelsPanel, RolePanel, Role, SelectAllMixin, NodeList, NodeGroup;

NodeListScreen = React.createClass({
  mixins: [
    pollingMixin(20, true),
    backboneMixin('cluster', 'change:status'),
    backboneMixin('nodes', 'update change'),
    backboneMixin({
      modelOrCollection: (props) => props.cluster && props.cluster.get('tasks'),
      renderOn: 'update change:status'
    }),
    dispatcherMixin('labelsConfigurationUpdated', 'normalizeAppliedFilters')
  ],
  getDefaultProps() {
    return {
      showBatchActionButtons: true,
      showLabelManagementButton: true,
      showViewModeButtons: true,
      nodeActionsAvailable: true
    };
  },
  getInitialState() {
    return {isLabelsPanelOpen: false};
  },
  selectNodes(ids, name, checked) {
    this.props.selectNodes(ids, checked);
  },
  fetchData() {
    return this.props.nodes.fetch();
  },
  calculateFilterLimits() {
    _.invokeMap(this.props.availableFilters, 'updateLimits', this.props.nodes, true);
    _.invokeMap(this.props.activeFilters, 'updateLimits', this.props.nodes, false);
  },
  normalizeAppliedFilters(checkStandardNodeFilters = false) {
    var {nodes, activeFilters, updateFilters} = this.props;
    var normalizedFilters = _.map(activeFilters, (activeFilter) => {
      var filter = _.clone(activeFilter);
      if (filter.values.length) {
        if (filter.isLabel) {
          filter.values = _.intersection(filter.values, nodes.getLabelValues(filter.name));
        } else if (
          checkStandardNodeFilters &&
          _.includes(['manufacturer', 'group_id', 'cluster'], filter.name)
        ) {
          filter.values = _.filter(filter.values, (value) => nodes.some({[filter.name]: value}));
        }
      }
      return filter;
    });
    if (!_.isEqual(_.map(normalizedFilters, 'values'), _.map(activeFilters, 'values'))) {
      updateFilters(normalizedFilters);
    }
  },
  componentWillMount() {
    var {mode, nodes, updateSearch, showRolePanel} = this.props;
    this.updateInitialRoles();
    nodes.on('update reset', this.updateInitialRoles, this);

    if (mode !== 'edit') {
      nodes.on('update reset', this.calculateFilterLimits, this);
      this.normalizeAppliedFilters(true);
      this.changeSearch = _.debounce(updateSearch, 200, {leading: true});
    }

    if (showRolePanel) {
      // hack to prevent node roles update after node polling
      nodes.on('change:pending_roles', this.checkRoleAssignment, this);
    }
  },
  componentWillUnmount() {
    this.props.nodes.off('update reset', this.updateInitialRoles, this);
    this.props.nodes.off('update reset', this.calculateFilterLimits, this);
    this.props.nodes.off('change:pending_roles', this.checkRoleAssignment, this);
  },
  processRoleLimits() {
    var {cluster, nodes, selectedNodeIds, selectedRoles, configModels} = this.props;
    var maxNumberOfNodes = [];
    var processedRoleLimits = {};
    var selectedNodes = nodes.filter((node) => selectedNodeIds[node.id]);
    var clusterNodes = cluster.get('nodes').filter(
      (node) => !_.includes(selectedNodeIds, node.id)
    );
    var nodesForLimitCheck = new models.Nodes(_.union(selectedNodes, clusterNodes));

    cluster.get('roles').each((role) => {
      if ((role.get('limits') || {}).max) {
        var roleName = role.get('name');
        var isRoleAlreadyAssigned = nodesForLimitCheck.some((node) => node.hasRole(roleName));
        processedRoleLimits[roleName] = role.checkLimits(
          configModels,
          nodesForLimitCheck,
          !isRoleAlreadyAssigned,
          ['max']
        );
      }
    });

    _.each(processedRoleLimits, (roleLimit, roleName) => {
      if (_.includes(selectedRoles, roleName)) maxNumberOfNodes.push(roleLimit.limits.max);
    });

    return {
      // need to cache roles with limits in order to avoid calculating this twice on the RolePanel
      processedRoleLimits,
      // real number of nodes to add used by Select All controls
      maxNumberOfNodes: maxNumberOfNodes.length ?
      _.min(maxNumberOfNodes) - _.size(selectedNodeIds) : null
    };
  },
  updateInitialRoles() {
    this.initialRoles = _.zipObject(this.props.nodes.map('id'),
      this.props.nodes.map('pending_roles'));
  },
  checkRoleAssignment(node, roles, options) {
    if (!options.assign) node.set({pending_roles: node.previous('pending_roles')}, {assign: true});
  },
  hasChanges() {
    return this.props.showRolePanel && this.props.nodes.some((node) => {
      return !_.isEqual(node.get('pending_roles'), this.initialRoles[node.id]);
    });
  },
  addSorting(sorter) {
    this.props.updateSorting(this.props.activeSorters.concat(sorter));
  },
  removeSorting(sorter) {
    this.props.updateSorting(_.difference(this.props.activeSorters, [sorter]));
  },
  resetSorters() {
    this.props.updateSorting(
      _.map(this.props.defaultSorting, _.partial(Sorter.fromObject, _, false))
    );
  },
  changeSortingOrder(sorterToChange) {
    this.props.updateSorting(
      this.props.activeSorters.map((sorter) => {
        var {name, order, isLabel} = sorter;
        if (name === sorterToChange.name && isLabel === sorterToChange.isLabel) {
          return new Sorter(name, order === 'asc' ? 'desc' : 'asc', isLabel);
        }
        return sorter;
      })
    );
  },
  getFilterOptions(filter) {
    if (filter.isLabel) {
      var values = _.uniq(this.props.nodes.getLabelValues(filter.name));
      var ns = 'cluster_page.nodes_tab.node_management_panel.';
      return values.map((value) => {
        return {
          name: value,
          label: _.isNull(value) ? i18n(ns + 'label_value_not_specified') : value === false ?
            i18n(ns + 'label_not_assigned') : value
        };
      });
    }

    var options;
    switch (filter.name) {
      case 'status':
        var os = this.props.cluster && this.props.cluster.get('release').get('operating_system') ||
          'OS';
        options = this.props.statusesToFilter.map((status) => {
          return {
            name: status,
            label: i18n('cluster_page.nodes_tab.node.status.' + status, {os: os})
          };
        });
        break;
      case 'manufacturer':
        options = _.uniq(this.props.nodes.map('manufacturer')).map((manufacturer) => {
          manufacturer = manufacturer || '';
          return {
            name: manufacturer.replace(/\s/g, '_'),
            label: manufacturer
          };
        });
        break;
      case 'roles':
        options = this.props.roles.invokeMap('pick', 'name', 'label');
        break;
      case 'group_id':
        options = _.uniq(this.props.nodes.map('group_id')).map((groupId) => {
          var nodeNetworkGroup = this.props.nodeNetworkGroups.get(groupId);
          return {
            name: groupId,
            label: nodeNetworkGroup ?
                nodeNetworkGroup.get('name') +
                (
                  this.props.cluster ?
                  '' :
                ' (' + this.props.clusters.get(nodeNetworkGroup.get('cluster_id')).get('name') + ')'
                )
              :
                i18n('common.not_specified')
          };
        });
        break;
      case 'cluster':
        options = _.uniq(this.props.nodes.map('cluster')).map((clusterId) => {
          return {
            name: clusterId,
            label: clusterId ? this.props.clusters.get(clusterId).get('name') :
              i18n('cluster_page.nodes_tab.node.unallocated')
          };
        });
        break;
    }

    // sort option list
    options.sort((option1, option2) => {
      // sort Node Network Group filter options by node network group id
      if (this.props.name === 'group_id') return option1.name - option2.name;
      return utils.natsort(option1.label, option2.label, {insensitive: true});
    });

    return options;
  },
  addFilter(filter) {
    this.props.updateFilters(this.props.activeFilters.concat(filter));
  },
  changeFilter(filterToChange, values) {
    this.props.updateFilters(
      this.props.activeFilters.map((filter) => {
        var {name, limits, isLabel} = filter;
        if (name === filterToChange.name && isLabel === filterToChange.isLabel) {
          var changedFilter = new Filter(name, values, isLabel);
          changedFilter.limits = limits;
          return changedFilter;
        }
        return filter;
      })
    );
  },
  removeFilter(filter) {
    this.props.updateFilters(_.difference(this.props.activeFilters, [filter]));
  },
  resetFilters() {
    this.props.updateFilters(Filter.fromObject(this.props.defaultFilters, false));
  },
  revertChanges() {
    this.props.nodes.each((node) => {
      node.set({pending_roles: this.initialRoles[node.id]}, {silent: true});
    });
  },
  toggleLabelsPanel(value) {
    this.setState({
      isLabelsPanelOpen: _.isUndefined(value) ? !this.state.isLabelsPanelOpen : value
    });
  },
  getNodeLabels() {
    return _.chain(this.props.nodes.map('labels')).flatten().map(_.keys).flatten().uniq().value();
  },
  getFilterResults(filter, node) {
    var result;
    switch (filter.name) {
      case 'roles':
        result = _.some(filter.values, (role) => node.hasRole(role));
        break;
      case 'status':
        result = _.includes(filter.values, 'offline') && !node.get('online') ||
          _.includes(filter.values, 'error') && node.get('status') === 'error' ||
          _.includes(filter.values, node.getStatusSummary());
        break;
      case 'manufacturer':
      case 'cluster':
      case 'group_id':
        result = _.includes(filter.values, node.get(filter.name));
        break;
      default:
        // handle number ranges
        var currentValue = node.resource(filter.name);
        if (filter.name === 'hdd' || filter.name === 'ram') {
          currentValue = currentValue / Math.pow(1024, 3);
        }
        result = currentValue >= filter.values[0] &&
          (_.isUndefined(filter.values[1]) || currentValue <= filter.values[1]);
        break;
    }
    return result;
  },
  render() {
    var {cluster, nodes, selectedNodeIds, search, activeFilters, showRolePanel} = this.props;
    var locked = !!cluster && !!cluster.task({group: 'deployment', active: true});
    var processedRoleData = cluster ? this.processRoleLimits() : {};

    // labels to manage in labels panel
    var selectedNodes = new models.Nodes(nodes.filter((node) => selectedNodeIds[node.id]));
    var selectedNodeLabels = _.chain(selectedNodes.map('labels'))
      .flatten()
      .map(_.keys)
      .flatten()
      .uniq()
      .value();

    // filter nodes
    var filteredNodes = nodes.filter((node) => {
      // search field
      if (
        search &&
        _.every(node.pick('name', 'mac', 'ip'), (attribute) => {
          return !_.includes((attribute || '').toLowerCase(), search.toLowerCase());
        })
      ) {
        return false;
      }

      // filters
      return _.every(activeFilters, (filter) => {
        if (!filter.values.length) return true;
        if (filter.isLabel) {
          return _.includes(filter.values, node.getLabel(filter.name));
        }
        return this.getFilterResults(filter, node);
      });
    });

    var screenNodesLabels = this.getNodeLabels();
    return (
      <div>
        {this.props.mode === 'edit' &&
          <div className='alert alert-warning'>
            {i18n('cluster_page.nodes_tab.disk_configuration_reset_warning')}
          </div>
        }
        <ManagementPanel
          {...this.props}
          {... _.pick(this,
            'addSorting',
            'removeSorting',
            'resetSorters',
            'changeSortingOrder',
            'addFilter',
            'changeFilter',
            'removeFilter',
            'resetFilters',
            'getFilterOptions',
            'changeSearch',
            'toggleLabelsPanel'
          )}
          isLabelsPanelOpen={this.state.isLabelsPanelOpen}
          labelSorters={screenNodesLabels.map((name) => new Sorter(name, 'asc', true))}
          labelFilters={screenNodesLabels.map((name) => new Filter(name, [], true))}
          nodes={selectedNodes}
          screenNodes={nodes}
          filteredNodes={filteredNodes}
          selectedNodeLabels={selectedNodeLabels}
          hasChanges={this.hasChanges()}
          locked={locked}
          revertChanges={this.revertChanges}
          selectNodes={this.selectNodes}
        />
        {showRolePanel &&
          <RolePanel
            {... _.pick(this.props,
              'cluster',
              'mode',
              'nodes',
              'selectedNodeIds',
              'selectedRoles',
              'indeterminateRoles',
              'selectRoles',
              'configModels'
            )}
            {... _.pick(processedRoleData, 'processedRoleLimits')}
          />
        }
        <NodeList
          {... _.pick(this.props,
            'cluster', 'mode', 'statusesToFilter', 'selectedNodeIds',
            'clusters', 'roles', 'nodeNetworkGroups', 'nodeActionsAvailable',
            'viewMode', 'activeSorters', 'selectedRoles'
          )}
          {... _.pick(processedRoleData, 'maxNumberOfNodes', 'processedRoleLimits')}
          nodes={filteredNodes}
          totalNodesLength={nodes.length}
          locked={this.state.isLabelsPanelOpen}
          selectNodes={this.selectNodes}
        />
      </div>
    );
  }
});

MultiSelectControl = React.createClass({
  propTypes: {
    name: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.bool]),
    options: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    values: React.PropTypes.arrayOf(React.PropTypes.oneOfType([
      React.PropTypes.string,
      React.PropTypes.bool
    ])),
    label: React.PropTypes.node.isRequired,
    dynamicValues: React.PropTypes.bool,
    onChange: React.PropTypes.func,
    extraContent: React.PropTypes.node,
    toggle: React.PropTypes.func.isRequired,
    isOpen: React.PropTypes.bool.isRequired
  },
  getDefaultProps() {
    return {
      values: [],
      isOpen: false
    };
  },
  onChange(name, checked, isLabel) {
    if (!this.props.dynamicValues) {
      var values = name === 'all' ?
          checked ? _.map(this.props.options, 'name') : []
        :
          checked ? _.union(this.props.values, [name]) : _.difference(this.props.values, [name]);
      this.props.onChange(values);
    } else {
      this.props.onChange(_.find(this.props.options, {name: name, isLabel: isLabel}));
    }
  },
  closeOnEscapeKey(e) {
    if (e.key === 'Escape') this.props.toggle(false);
  },
  render() {
    if (!this.props.options.length) return null;

    var valuesAmount = this.props.values.length;
    var label = this.props.label;
    if (!this.props.dynamicValues && valuesAmount) {
      label = this.props.label + ': ' + (valuesAmount > 3 ?
          i18n(
            'cluster_page.nodes_tab.node_management_panel.selected_options',
            {label: this.props.label, count: valuesAmount}
          )
        :
          _.map(this.props.values, (itemName) => {
            return _.find(this.props.options, {name: itemName}).label;
          }).join(', '));
    }

    var attributes, labels;
    if (this.props.dynamicValues) {
      var groupedOptions = _.groupBy(this.props.options, 'isLabel');
      attributes = groupedOptions.false || [];
      labels = groupedOptions.true || [];
    }

    var optionProps = (option) => {
      return {
        key: option.name,
        type: 'checkbox',
        name: option.name,
        label: option.title
      };
    };

    var classNames = {
      'btn-group multiselect': true,
      open: this.props.isOpen,
      'more-control': this.props.dynamicValues
    };
    if (this.props.className) classNames[this.props.className] = true;

    return (
      <div className={utils.classNames(classNames)} tabIndex='-1' onKeyDown={this.closeOnEscapeKey}>
        <button
          className={'btn dropdown-toggle ' + ((this.props.dynamicValues && !this.props.isOpen) ?
            'btn-link' : 'btn-default')
          }
          onClick={this.props.toggle}
        >
          {label} <span className='caret'></span>
        </button>
        {this.props.isOpen &&
          <Popover toggle={this.props.toggle}>
            {!this.props.dynamicValues ?
              <div>
                <div key='all'>
                  <Input
                    type='checkbox'
                    label={i18n('cluster_page.nodes_tab.node_management_panel.select_all')}
                    name='all'
                    checked={valuesAmount === this.props.options.length}
                    onChange={this.onChange}
                  />
                </div>
                <div key='divider' className='divider' />
                {_.map(this.props.options, (option) => {
                  return <Input {...optionProps(option)}
                    label={option.label}
                    checked={_.includes(this.props.values, option.name)}
                    onChange={this.onChange}
                  />;
                })}
              </div>
            :
              <div>
                {_.map(attributes, (option) => {
                  return <Input {...optionProps(option)}
                    checked={_.includes(this.props.values, option.name)}
                    onChange={_.partialRight(this.onChange, false)}
                  />;
                })}
                {!!attributes.length && !!labels.length &&
                  <div key='divider' className='divider' />
                }
                {_.map(labels, (option) => {
                  return <Input {...optionProps(option)}
                    key={'label-' + option.name}
                    onChange={_.partialRight(this.onChange, true)}
                  />;
                })}
              </div>
            }
          </Popover>
        }
        {this.props.extraContent}
      </div>
    );
  }
});

NumberRangeControl = React.createClass({
  propTypes: {
    name: React.PropTypes.string,
    label: React.PropTypes.node.isRequired,
    values: React.PropTypes.array,
    onChange: React.PropTypes.func,
    extraContent: React.PropTypes.node,
    prefix: React.PropTypes.string,
    min: React.PropTypes.number,
    max: React.PropTypes.number,
    toggle: React.PropTypes.func.isRequired,
    isOpen: React.PropTypes.bool.isRequired
  },
  getDefaultProps() {
    return {
      values: [],
      isOpen: false,
      min: 0,
      max: 0
    };
  },
  changeValue(name, value, index) {
    var values = this.props.values;
    values[index] = _.max([Number(value), 0]);
    this.props.onChange(values);
  },
  closeOnEscapeKey(e) {
    if (e.key === 'Escape') this.props.toggle(this.props.name, false);
  },
  render() {
    var classNames = {'btn-group number-range': true, open: this.props.isOpen};
    if (this.props.className) classNames[this.props.className] = true;
    var props = {
      type: 'number',
      inputClassName: 'pull-left',
      min: this.props.min,
      max: this.props.max,
      error: this.props.values[0] > this.props.values[1] || null
    };

    return (
      <div className={utils.classNames(classNames)} tabIndex='-1' onKeyDown={this.closeOnEscapeKey}>
        <button className='btn btn-default dropdown-toggle' onClick={this.props.toggle}>
          {this.props.label + ': ' + _.uniq(this.props.values).join(' - ')}
          {' '}
          <span className='caret' />
        </button>
        {this.props.isOpen &&
          <Popover toggle={this.props.toggle}>
            <div className='clearfix'>
              <Input {...props}
                name='start'
                value={this.props.values[0]}
                onChange={_.partialRight(this.changeValue, 0)}
                autoFocus
              />
              <span className='pull-left'> &mdash; </span>
              <Input {...props}
                name='end'
                value={this.props.values[1]}
                onChange={_.partialRight(this.changeValue, 1)}
              />
            </div>
          </Popover>
        }
        {this.props.extraContent}
      </div>
    );
  }
});

ManagementPanel = React.createClass({
  mixins: [unsavedChangesMixin],
  getInitialState() {
    return {
      actionInProgress: false,
      isSearchButtonVisible: !!this.props.search,
      activeSearch: !!this.props.search,
      openFilter: null,
      isMoreFilterControlVisible: false,
      isMoreSorterControlVisible: false
    };
  },
  changeScreen(url, passNodeIds) {
    url = url ? '/' + url : '';
    if (passNodeIds) url += '/' + utils.serializeTabOptions({nodes: this.props.nodes.map('id')});
    app.navigate('#cluster/' + this.props.cluster.id + '/nodes' + url, {trigger: true});
  },
  goToConfigurationScreen(action, conflict) {
    if (conflict) {
      var ns = 'cluster_page.nodes_tab.node_management_panel.node_management_error.';
      utils.showErrorDialog({
        title: i18n(ns + 'title'),
        message: <div>
          <i className='glyphicon glyphicon-danger-sign' />
          {i18n(ns + action + '_configuration_warning')}
        </div>
      });
      return;
    }
    this.changeScreen(action, true);
  },
  showDeleteNodesDialog() {
    var {cluster, nodes, selectNodes} = this.props;
    DeleteNodesDialog
      .show({nodes, cluster})
      .then(_.partial(selectNodes, _.map(nodes.filter({status: 'ready'}), 'id'), null, true));
  },
  hasChanges() {
    return this.props.hasChanges;
  },
  isSavingPossible() {
    return !this.state.actionInProgress && this.hasChanges();
  },
  revertChanges() {
    return this.props.revertChanges();
  },
  applyChanges() {
    if (!this.isSavingPossible()) return $.Deferred().reject();

    this.setState({actionInProgress: true});
    var nodes = new models.Nodes(this.props.nodes.map((node) => {
      var data = {id: node.id, pending_roles: node.get('pending_roles')};
      if (node.get('pending_roles').length) {
        if (this.props.mode === 'add') {
          return _.extend(data, {cluster_id: this.props.cluster.id, pending_addition: true});
        }
      } else if (node.get('pending_addition')) {
        return _.extend(data, {cluster_id: null, pending_addition: false});
      }
      return data;
    }));

    return Backbone.sync('update', nodes)
      .then(
        () => $.when(
          this.props.cluster.fetch(),
          this.props.cluster.fetchRelated('nodes')
        ),
        (response) => {
          this.setState({actionInProgress: false});
          utils.showErrorDialog({
            message: i18n('cluster_page.nodes_tab.node_management_panel.' +
              'node_management_error.saving_warning'),
            response
          });
        }
      )
      .then(null, () => $.Deferred().resolve())
      .then(() => {
        if (this.props.mode === 'add') {
          dispatcher.trigger('updateNodeStats networkConfigurationUpdated ' +
            'labelsConfigurationUpdated');
          this.props.selectNodes();
        }
      });
  },
  applyAndRedirect() {
    this.applyChanges().then(_.partial(this.changeScreen, '', false));
  },
  searchNodes(name, value) {
    this.setState({isSearchButtonVisible: !!value});
    this.props.changeSearch(value);
  },
  clearSearchField() {
    this.setState({isSearchButtonVisible: false});
    this.refs.search.getInputDOMNode().value = '';
    this.refs.search.getInputDOMNode().focus();
    this.props.changeSearch.cancel();
    this.props.updateSearch('');
  },
  activateSearch() {
    this.setState({activeSearch: true});
    $('html').on('click.search', (e) => {
      if (!this.props.search && this.refs.search &&
        !$(e.target).closest(ReactDOM.findDOMNode(this.refs.search)).length) {
        this.setState({activeSearch: false});
      }
    });
  },
  onSearchKeyDown(e) {
    if (e.key === 'Escape') {
      this.clearSearchField();
      this.setState({activeSearch: false});
    }
  },
  componentWillUnmount() {
    $('html').off('click.search');
  },
  removeSorting(sorter) {
    this.props.removeSorting(sorter);
    this.setState({
      sortersKey: _.now(),
      isMoreSorterControlVisible: false
    });
  },
  resetSorters(e) {
    e.stopPropagation();
    this.props.resetSorters();
    this.setState({
      sortersKey: _.now(),
      isMoreSorterControlVisible: false
    });
  },
  toggleFilter(filter, visible) {
    var isFilterOpen = this.isFilterOpen(filter);
    visible = _.isBoolean(visible) ? visible : !isFilterOpen;
    this.setState({
      openFilter: visible ? filter : isFilterOpen ? null : this.state.openFilter
    });
  },
  toggleMoreFilterControl(visible) {
    this.setState({
      isMoreFilterControlVisible: _.isBoolean(visible) ? visible :
        !this.state.isMoreFilterControlVisible,
      openFilter: null
    });
  },
  toggleMoreSorterControl(visible) {
    this.setState({
      isMoreSorterControlVisible: _.isBoolean(visible) ? visible :
        !this.state.isMoreSorterControlVisible
    });
  },
  isFilterOpen(filter) {
    return !_.isNull(this.state.openFilter) &&
      this.state.openFilter.name === filter.name &&
        this.state.openFilter.isLabel === filter.isLabel;
  },
  addFilter(filter) {
    this.props.addFilter(filter);
    this.toggleMoreFilterControl();
    this.toggleFilter(filter, true);
  },
  removeFilter(filter) {
    this.props.removeFilter(filter);
    this.setState({filtersKey: _.now()});
    this.toggleFilter(filter, false);
  },
  resetFilters(e) {
    e.stopPropagation();
    this.props.resetFilters();
    this.setState({
      filtersKey: _.now(),
      openFilter: null
    });
  },
  toggleSorters() {
    this.setState({
      newLabels: [],
      areSortersVisible: !this.state.areSortersVisible,
      isMoreSorterControlVisible: false,
      areFiltersVisible: false
    });
    this.props.toggleLabelsPanel(false);
  },
  toggleFilters() {
    this.setState({
      newLabels: [],
      areFiltersVisible: !this.state.areFiltersVisible,
      openFilter: null,
      areSortersVisible: false
    });
    this.props.toggleLabelsPanel(false);
  },
  renderDeleteFilterButton(filter) {
    if (!filter.isLabel && _.includes(_.keys(this.props.defaultFilters), filter.name)) return null;
    return (
      <i
        className='btn btn-link glyphicon glyphicon-minus-sign btn-remove-filter'
        onClick={_.partial(this.removeFilter, filter)}
      />
    );
  },
  toggleLabelsPanel() {
    this.setState({
      newLabels: [],
      areFiltersVisible: false,
      areSortersVisible: false
    });
    this.props.toggleLabelsPanel();
  },
  renderDeleteSorterButton(sorter) {
    return (
      <i
        className='btn btn-link glyphicon glyphicon-minus-sign btn-remove-sorting'
        onClick={_.partial(this.removeSorting, sorter)}
      />
    );
  },
  render() {
    var {
      nodes, screenNodes, filteredNodes, mode, locked, showBatchActionButtons,
      viewMode, changeViewMode, showViewModeButtons,
      search,
      activeSorters, availableSorters, labelSorters, defaultSorting, changeSortingOrder, addSorting,
      activeFilters, availableFilters, labelFilters, changeFilter, getFilterOptions,
      isLabelsPanelOpen, selectedNodeLabels, showLabelManagementButton,
      revertChanges
    } = this.props;
    var ns = 'cluster_page.nodes_tab.node_management_panel.';

    var disksConflict, interfaceConflict, inactiveSorters, canResetSorters,
      inactiveFilters, appliedFilters;
    if (mode === 'list' && nodes.length) {
      disksConflict = !nodes.areDisksConfigurable();
      interfaceConflict = !nodes.areInterfacesConfigurable();
    }

    var managementButtonClasses = (isActive, className) => {
      var classes = {
        'btn btn-default pull-left': true,
        active: isActive
      };
      classes[className] = true;
      return classes;
    };

    if (mode !== 'edit') {
      var checkSorter = ({name}, isLabel) => !_.some(activeSorters, {name, isLabel});
      inactiveSorters = _.union(
        _.filter(availableSorters, _.partial(checkSorter, _, false)),
        _.filter(labelSorters, _.partial(checkSorter, _, true))
      )
        .sort((sorter1, sorter2) => {
          return utils.natsort(sorter1.title, sorter2.title, {insensitive: true});
        });
      canResetSorters = _.some(activeSorters, {isLabel: true}) ||
        !_(activeSorters)
          .filter({isLabel: false})
          .map(Sorter.toObject)
          .isEqual(defaultSorting);

      var checkFilter = ({name}, isLabel) => !_.some(activeFilters, {name, isLabel});
      inactiveFilters = _.union(
        _.filter(availableFilters, _.partial(checkFilter, _, false)),
        _.filter(labelFilters, _.partial(checkFilter, _, true))
      )
        .sort((filter1, filter2) => {
          return utils.natsort(filter1.title, filter2.title, {insensitive: true});
        });
      appliedFilters = _.reject(activeFilters, ({values}) => !values.length);
    }

    selectedNodeLabels.sort(_.partialRight(utils.natsort, {insensitive: true}));

    return (
      <div className='row'>
        <div className='sticker node-management-panel'>
          <div className='node-list-management-buttons col-xs-5'>
            {showViewModeButtons &&
              <div className='view-mode-switcher'>
                <div className='btn-group' data-toggle='buttons'>
                  {_.map(models.Nodes.prototype.viewModes, (mode) => {
                    return (
                      <Tooltip key={mode + '-view'} text={i18n(ns + mode + '_mode_tooltip')}>
                        <label
                          className={utils.classNames(
                            managementButtonClasses(mode === viewMode, mode)
                          )}
                          onClick={
                            mode !== viewMode && _.partial(changeViewMode, mode)
                          }
                        >
                          <input type='radio' name='view_mode' value={mode} />
                          <i
                            className={utils.classNames({
                              glyphicon: true,
                              'glyphicon-th-list': mode === 'standard',
                              'glyphicon-th': mode === 'compact'
                            })}
                          />
                        </label>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            }
            {mode !== 'edit' && [
              showLabelManagementButton &&
                <Tooltip wrap key='labels-btn' text={i18n(ns + 'labels_tooltip')}>
                  <button
                    disabled={!nodes.length}
                    onClick={nodes.length && this.toggleLabelsPanel}
                    className={utils.classNames(
                      managementButtonClasses(isLabelsPanelOpen, 'btn-labels')
                    )}
                  >
                    <i className='glyphicon glyphicon-tag' />
                  </button>
                </Tooltip>,
              <Tooltip wrap key='sorters-btn' text={i18n(ns + 'sort_tooltip')}>
                <button
                  disabled={!screenNodes.length}
                  onClick={this.toggleSorters}
                  className={utils.classNames(
                    managementButtonClasses(this.state.areSortersVisible, 'btn-sorters')
                  )}
                >
                  <i className='glyphicon glyphicon-sort' />
                </button>
              </Tooltip>,
              <Tooltip wrap key='filters-btn' text={i18n(ns + 'filter_tooltip')}>
                <button
                  disabled={!screenNodes.length}
                  onClick={this.toggleFilters}
                  className={utils.classNames(
                    managementButtonClasses(this.state.areFiltersVisible, 'btn-filters')
                  )}
                >
                  <i className='glyphicon glyphicon-filter' />
                </button>
              </Tooltip>,
              !this.state.activeSearch && (
                <Tooltip wrap key='search-btn' text={i18n(ns + 'search_tooltip')}>
                  <button
                    disabled={!screenNodes.length}
                    onClick={this.activateSearch}
                    className={utils.classNames(managementButtonClasses(false, 'btn-search'))}
                  >
                    <i className='glyphicon glyphicon-search' />
                  </button>
                </Tooltip>
              ),
              this.state.activeSearch && (
                <div className='search pull-left' key='search'>
                  <Input
                    type='text'
                    name='search'
                    ref='search'
                    defaultValue={search}
                    placeholder={i18n(ns + 'search_placeholder')}
                    disabled={!screenNodes.length}
                    onChange={this.searchNodes}
                    onKeyDown={this.onSearchKeyDown}
                    autoFocus
                  />
                  {this.state.isSearchButtonVisible &&
                    <button
                      className='close btn-clear-search'
                      onClick={this.clearSearchField}
                    >
                      &times;
                    </button>
                  }
                </div>
              )
            ]}
          </div>
          <div className='control-buttons-box col-xs-7 text-right'>
            {showBatchActionButtons && (
              mode !== 'list' ?
                <div className='btn-group' role='group'>
                  <button
                    className='btn btn-default'
                    disabled={this.state.actionInProgress}
                    onClick={() => {
                      revertChanges();
                      this.changeScreen();
                    }}
                  >
                    {i18n('common.cancel_button')}
                  </button>
                  <ProgressButton
                    className='btn btn-success btn-apply'
                    disabled={!this.isSavingPossible()}
                    onClick={this.applyAndRedirect}
                    progress={this.state.actionInProgress}
                  >
                    {i18n('common.apply_changes_button')}
                  </ProgressButton>
                </div>
              :
                [
                  <div className='btn-group' role='group' key='configuration-buttons'>
                    <button
                      className='btn btn-default btn-configure-disks'
                      disabled={!nodes.length}
                      onClick={() => this.goToConfigurationScreen('disks', disksConflict)}
                    >
                      {disksConflict && <i className='glyphicon glyphicon-danger-sign' />}
                      {i18n('dialog.show_node.disk_configuration' +
                        (_.every(nodes.invokeMap('areDisksConfigurable')) ? '_action' : ''))
                      }
                    </button>
                    <button
                      className='btn btn-default btn-configure-interfaces'
                      disabled={!nodes.length}
                      onClick={() => this.goToConfigurationScreen('interfaces', interfaceConflict)}
                    >
                      {interfaceConflict && <i className='glyphicon glyphicon-danger-sign' />}
                      {i18n('dialog.show_node.network_configuration' +
                        (_.every(nodes.invokeMap('areInterfacesConfigurable')) ? '_action' : ''))
                      }
                    </button>
                  </div>,
                  <div className='btn-group' role='group' key='role-management-buttons'>
                    {!locked && !!nodes.length && nodes.some({pending_deletion: false}) &&
                      <button
                        className='btn btn-danger btn-delete-nodes'
                        onClick={this.showDeleteNodesDialog}
                      >
                        <i className='glyphicon glyphicon-trash' />
                        {i18n('common.delete_button')}
                      </button>
                    }
                    {!!nodes.length && !nodes.some({pending_addition: false}) &&
                      <button
                        className='btn btn-success btn-edit-roles'
                        onClick={_.partial(this.changeScreen, 'edit', true)}
                      >
                        <i className='glyphicon glyphicon-edit' />
                        {i18n(ns + 'edit_roles_button')}
                      </button>
                    }
                  </div>,
                  !locked &&
                    <div className='btn-group' role='group' key='add-nodes-button'>
                      <button
                        className='btn btn-success btn-add-nodes'
                        onClick={_.partial(this.changeScreen, 'add', false)}
                        disabled={locked}
                      >
                        <i className='glyphicon glyphicon-plus-white' />
                        {i18n(ns + 'add_nodes_button')}
                      </button>
                    </div>
                ]
            )}
          </div>
          {mode !== 'edit' && !!screenNodes.length && [
            isLabelsPanelOpen &&
              <NodeLabelsPanel {... _.pick(this.props, 'nodes', 'screenNodes')}
                key='labels'
                labels={selectedNodeLabels}
                toggleLabelsPanel={this.toggleLabelsPanel}
              />,
            this.state.areSortersVisible && (
              <div className='col-xs-12 sorters' key='sorters'>
                <div className='well clearfix' key={this.state.sortersKey}>
                  <div className='well-heading'>
                    <i className='glyphicon glyphicon-sort' /> {i18n(ns + 'sort_by')}
                    {canResetSorters &&
                      <button
                        className='btn btn-link pull-right btn-reset-sorting'
                        onClick={this.resetSorters}
                      >
                        <i className='glyphicon discard-changes-icon' /> {i18n(ns + 'reset')}
                      </button>
                    }
                  </div>
                  {activeSorters.map((sorter) => {
                    var asc = sorter.order === 'asc';
                    return (
                      <div
                        key={'sort_by-' + sorter.name + (sorter.isLabel && '-label')}
                        className={utils.classNames({
                          'sorter-control pull-left': true,
                          ['sort-by-' + sorter.name + '-' + sorter.order]: !sorter.isLabel
                        })}
                      >
                        <button
                          className='btn btn-default'
                          onClick={_.partial(changeSortingOrder, sorter)}
                        >
                          {sorter.title}
                          <i
                            className={utils.classNames({
                              glyphicon: true,
                              'glyphicon-arrow-down': asc,
                              'glyphicon-arrow-up': !asc
                            })}
                          />
                        </button>
                        {activeSorters.length > 1 && this.renderDeleteSorterButton(sorter)}
                      </div>
                    );
                  })}
                  <MultiSelectControl
                    name='sorter-more'
                    label={i18n(ns + 'more')}
                    options={inactiveSorters}
                    onChange={addSorting}
                    dynamicValues
                    isOpen={this.state.isMoreSorterControlVisible}
                    toggle={this.toggleMoreSorterControl}
                  />
                </div>
              </div>
            ),
            this.state.areFiltersVisible && (
              <div className='col-xs-12 filters' key='filters'>
                <div className='well clearfix' key={this.state.filtersKey}>
                  <div className='well-heading'>
                    <i className='glyphicon glyphicon-filter' /> {i18n(ns + 'filter_by')}
                    {!!appliedFilters.length &&
                      <button
                        className='btn btn-link pull-right btn-reset-filters'
                        onClick={this.resetFilters}
                      >
                        <i className='glyphicon discard-changes-icon' /> {i18n(ns + 'reset')}
                      </button>
                    }
                  </div>
                  {_.map(activeFilters, (filter) => {
                    var props = {
                      key: (filter.isLabel ? 'label-' : '') + filter.name,
                      ref: filter.name,
                      name: filter.name,
                      values: filter.values,
                      className: utils.classNames({
                        'filter-control': true,
                        ['filter-by-' + filter.name]: !filter.isLabel
                      }),
                      label: filter.title,
                      extraContent: this.renderDeleteFilterButton(filter),
                      onChange: _.partial(changeFilter, filter),
                      prefix: i18n(
                        'cluster_page.nodes_tab.filters.prefixes.' + filter.name,
                        {defaultValue: ''}
                      ),
                      isOpen: this.isFilterOpen(filter),
                      toggle: _.partial(this.toggleFilter, filter)
                    };

                    if (filter.isNumberRange) {
                      return <NumberRangeControl
                        {...props}
                        min={filter.limits[0]}
                        max={filter.limits[1]}
                      />;
                    }
                    return <MultiSelectControl
                      {...props}
                      options={getFilterOptions(filter)}
                    />;
                  })}
                  <MultiSelectControl
                    name='filter-more'
                    label={i18n(ns + 'more')}
                    options={inactiveFilters}
                    onChange={this.addFilter}
                    dynamicValues
                    isOpen={this.state.isMoreFilterControlVisible}
                    toggle={this.toggleMoreFilterControl}
                  />
                </div>
              </div>
            )
          ]}
          {mode !== 'edit' && !!screenNodes.length &&
            <div className='col-xs-12'>
              {(!this.state.areSortersVisible || !this.state.areFiltersVisible &&
                !!appliedFilters.length) &&
                <div className='active-sorters-filters'>
                  {!this.state.areFiltersVisible && !!appliedFilters.length &&
                    <div className='active-filters row' onClick={this.toggleFilters}>
                      <strong className='col-xs-1'>{i18n(ns + 'filter_by')}</strong>
                      <div className='col-xs-11'>
                        {i18n('cluster_page.nodes_tab.filter_results_amount', {
                          count: filteredNodes.length,
                          total: screenNodes.length
                        })}
                        {_.map(appliedFilters, (filter) => {
                          var options = filter.isNumberRange ? null : getFilterOptions(filter);
                          return (
                            <div key={filter.name}>
                              <strong>{filter.title}{!!filter.values.length && ':'} </strong>
                              <span>
                                {filter.isNumberRange ?
                                  _.uniq(filter.values).join(' - ')
                                :
                                  _.map(
                                    _.filter(options, ({name}) => _.includes(filter.values, name))
                                  , 'label').join(', ')
                                }
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        className='btn btn-link btn-reset-filters'
                        onClick={this.resetFilters}
                      >
                        <i className='glyphicon discard-changes-icon' />
                      </button>
                    </div>
                  }
                  {!this.state.areSortersVisible &&
                    <div className='active-sorters row' onClick={this.toggleSorters}>
                      <strong className='col-xs-1'>{i18n(ns + 'sort_by')}</strong>
                      <div className='col-xs-11'>
                        {activeSorters.map((sorter, index) => {
                          var asc = sorter.order === 'asc';
                          return (
                            <span key={sorter.name + (sorter.isLabel && '-label')}>
                              {sorter.title}
                              <i
                                className={utils.classNames({
                                  glyphicon: true,
                                  'glyphicon-arrow-down': asc,
                                  'glyphicon-arrow-up': !asc
                                })}
                              />
                              {!!activeSorters[index + 1] && ' + '}
                            </span>
                          );
                        })}
                      </div>
                      {canResetSorters &&
                        <button
                          className='btn btn-link btn-reset-sorting'
                          onClick={this.resetSorters}
                        >
                          <i className='glyphicon discard-changes-icon' />
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    );
  }
});

NodeLabelsPanel = React.createClass({
  mixins: [unsavedChangesMixin],
  getInitialState() {
    var labels = _.map(this.props.labels, (label) => {
      var labelValues = this.props.nodes.getLabelValues(label);
      var definedLabelValues = _.reject(labelValues, _.isUndefined);
      return {
        key: label,
        values: _.uniq(definedLabelValues),
        checked: labelValues.length === definedLabelValues.length,
        indeterminate: labelValues.length !== definedLabelValues.length,
        error: null
      };
    });
    return {
      labels: _.cloneDeep(labels),
      initialLabels: _.cloneDeep(labels),
      actionInProgress: false
    };
  },
  hasChanges() {
    return !_.isEqual(this.state.labels, this.state.initialLabels);
  },
  componentDidMount() {
    _.each(this.state.labels, (labelData) => {
      this.refs[labelData.key].getInputDOMNode().indeterminate = labelData.indeterminate;
    });
  },
  addLabel() {
    var labels = this.state.labels;
    labels.push({
      key: '',
      values: [null],
      checked: false,
      error: null
    });
    this.setState({labels: labels});
  },
  changeLabelKey(index, oldKey, newKey) {
    var labels = this.state.labels;
    var labelData = labels[index];
    labelData.key = newKey;
    if (!labelData.indeterminate) labelData.checked = true;
    this.validateLabels(labels);
    this.setState({labels: labels});
  },
  changeLabelState(index, key, checked) {
    var labels = this.state.labels;
    var labelData = labels[index];
    labelData.checked = checked;
    labelData.indeterminate = false;
    this.validateLabels(labels);
    this.setState({labels: labels});
  },
  changeLabelValue(index, key, value) {
    var labels = this.state.labels;
    var labelData = labels[index];
    labelData.values = [value || null];
    if (!labelData.indeterminate) labelData.checked = true;
    this.validateLabels(labels);
    this.setState({labels: labels});
  },
  validateLabels(labels) {
    _.each(labels, (currentLabel, currentIndex) => {
      currentLabel.error = null;
      if (currentLabel.checked || currentLabel.indeterminate) {
        var ns = 'cluster_page.nodes_tab.node_management_panel.labels.';
        if (!_.trim(currentLabel.key)) {
          currentLabel.error = i18n(ns + 'empty_label_key');
        } else {
          var doesLabelExist = _.some(labels, (label, index) => {
            return index !== currentIndex &&
              _.trim(label.key) === _.trim(currentLabel.key) &&
              (label.checked || label.indeterminate);
          });
          if (doesLabelExist) currentLabel.error = i18n(ns + 'existing_label');
        }
      }
    });
  },
  isSavingPossible() {
    return !this.state.actionInProgress && this.hasChanges() &&
      _.every(_.map(this.state.labels, 'error'), _.isNull);
  },
  revertChanges() {
    return this.props.toggleLabelsPanel();
  },
  applyChanges() {
    if (!this.isSavingPossible()) return $.Deferred().reject();

    this.setState({actionInProgress: true});

    var nodes = new models.Nodes(
      this.props.nodes.map((node) => {
        var nodeLabels = node.get('labels');

        _.each(this.state.labels, (labelData, index) => {
          var oldLabel = this.props.labels[index];

          // delete label
          if (!labelData.checked && !labelData.indeterminate) {
            delete nodeLabels[oldLabel];
          }

          var nodeHasLabel = !_.isUndefined(nodeLabels[oldLabel]);
          var label = labelData.key;
          // rename label
          if ((labelData.checked || labelData.indeterminate) && nodeHasLabel) {
            var labelValue = nodeLabels[oldLabel];
            delete nodeLabels[oldLabel];
            nodeLabels[label] = labelValue;
          }
          // add label
          if (labelData.checked && !nodeHasLabel) {
            nodeLabels[label] = labelData.values[0];
          }
          // change label value
          if (!_.isUndefined(nodeLabels[label]) && labelData.values.length === 1) {
            nodeLabels[label] = labelData.values[0];
          }
        });

        return {id: node.id, labels: nodeLabels};
      })
    );

    return Backbone.sync('update', nodes)
      .then(
        () => this.props.screenNodes.fetch(),
        (response) => {
          utils.showErrorDialog({
            message: i18n(
              'cluster_page.nodes_tab.node_management_panel.' +
              'node_management_error.labels_warning'
            ),
            response
          });
        }
      )
      .then(null, () => $.Deferred().resolve())
      .then(() => {
        dispatcher.trigger('labelsConfigurationUpdated');
        this.props.screenNodes.trigger('change');
        this.props.toggleLabelsPanel();
      });
  },
  render() {
    var ns = 'cluster_page.nodes_tab.node_management_panel.labels.';

    return (
      <div className='col-xs-12 labels'>
        <div className='well clearfix'>
          <div className='well-heading'>
            <i className='glyphicon glyphicon-tag' /> {i18n(ns + 'manage_labels')}
          </div>
          <div className='forms-box form-inline'>
            <p>
              {i18n(ns + 'bulk_label_action_start')}
              <strong>
                {i18n(ns + 'selected_nodes_amount', {count: this.props.nodes.length})}
              </strong>
              {i18n(ns + 'bulk_label_action_end')}
            </p>

            {_.map(this.state.labels, (labelData, index) => {
              var labelValueProps = labelData.values.length > 1 ? {
                value: '',
                wrapperClassName: 'has-warning',
                tooltipText: i18n(ns + 'label_value_warning')
              } : {
                value: labelData.values[0]
              };

              var showControlLabels = index === 0;
              return (
                <div
                  className={utils.classNames({clearfix: true, 'has-label': showControlLabels})}
                  key={index}
                >
                  <Input
                    type='checkbox'
                    ref={labelData.key}
                    checked={labelData.checked}
                    onChange={_.partial(this.changeLabelState, index)}
                    wrapperClassName='pull-left'
                  />
                  <Input
                    type='text'
                    maxLength='100'
                    label={showControlLabels && i18n(ns + 'label_key')}
                    value={labelData.key}
                    onChange={_.partial(this.changeLabelKey, index)}
                    error={labelData.error}
                    wrapperClassName='label-key-control'
                    autoFocus={index === this.state.labels.length - 1}
                  />
                  <Input {...labelValueProps}
                    type='text'
                    maxLength='100'
                    label={showControlLabels && i18n(ns + 'label_value')}
                    onChange={_.partial(this.changeLabelValue, index)}
                  />
                </div>
              );
            })}
            <button
              className='btn btn-default btn-add-label'
              onClick={this.addLabel}
              disabled={this.state.actionInProgress}
            >
              {i18n(ns + 'add_label')}
            </button>
          </div>
          {!!this.state.labels.length &&
            <div className='control-buttons text-right'>
              <div className='btn-group' role='group'>
                <button
                  className='btn btn-default'
                  onClick={this.revertChanges}
                  disabled={this.state.actionInProgress}
                >
                  {i18n('common.cancel_button')}
                </button>
                <ProgressButton
                  className='btn btn-success'
                  onClick={this.applyChanges}
                  disabled={!this.isSavingPossible()}
                  progress={this.state.actionInProgress}
                >
                  {i18n('common.apply_button')}
                </ProgressButton>
              </div>
            </div>
          }
        </div>
      </div>
    );
  }
});

RolePanel = React.createClass({
  componentDidUpdate() {
    this.assignRoles();
  },
  assignRoles() {
    var {cluster, nodes, selectedNodeIds, selectedRoles, indeterminateRoles} = this.props;
    var roles = cluster.get('roles');

    nodes.each((node) => {
      if (selectedNodeIds[node.id]) {
        roles.each((role) => {
          var roleName = role.get('name');
          if (!node.hasRole(roleName, true)) {
            var nodeRoles = node.get('pending_roles');
            if (_.includes(selectedRoles, roleName)) {
              nodeRoles = _.union(nodeRoles, [roleName]);
            } else if (!_.includes(indeterminateRoles, roleName)) {
              nodeRoles = _.without(nodeRoles, roleName);
            }
            node.set({pending_roles: nodeRoles}, {assign: true});
          }
        });
      }
    });
  },
  processRestrictions(role) {
    var name = role.get('name');
    var restrictionsCheck = role.checkRestrictions(this.props.configModels, 'disable');
    var roleLimitsCheckResults = this.props.processedRoleLimits[name];
    var roles = this.props.cluster.get('roles');
    var conflicts = _.chain(this.props.selectedRoles)
      .union(this.props.indeterminateRoles)
      .map((role) => roles.find({name: role}).conflicts)
      .flatten()
      .uniq()
      .value();
    var warnings = [];

    if (restrictionsCheck.result && restrictionsCheck.message) {
      warnings.push(restrictionsCheck.message);
    }
    if (roleLimitsCheckResults && !roleLimitsCheckResults.valid && roleLimitsCheckResults.message) {
      warnings.push(roleLimitsCheckResults.message);
    }
    if (_.includes(conflicts, name)) {
      warnings.push(i18n('cluster_page.nodes_tab.role_conflict'));
    }

    return {
      result: restrictionsCheck.result || _.includes(conflicts, name) ||
        (roleLimitsCheckResults && !roleLimitsCheckResults.valid &&
          !_.includes(this.props.selectedRoles, name)
        ),
      warnings
    };
  },
  render() {
    var {cluster, nodes, selectedRoles, indeterminateRoles, selectRoles, configModels} = this.props;
    var groups = models.Roles.prototype.groups;
    var groupedRoles = cluster.get('roles').groupBy(
      (role) => _.includes(groups, role.get('group')) ? role.get('group') : 'other'
    );
    return (
      <div className='well role-panel'>
        <h4>{i18n('cluster_page.nodes_tab.assign_roles')}
          <div className='help-block'>{i18n('cluster_page.nodes_tab.assign_roles_help')}</div>
        </h4>
        {_.map(groups, (group) =>
          <div key={group} className={group + ' row'}>
            <div className='col-xs-1'>
              <h6>{group}</h6>
            </div>
            <div className='col-xs-11'>
              {_.map(groupedRoles[group], (role) => {
                if (role.checkRestrictions(configModels, 'hide').result) return null;
                var roleName = role.get('name');
                var selected = _.includes(selectedRoles, roleName);
                return (
                  <Role
                    key={roleName}
                    ref={roleName}
                    role={role}
                    selected={selected}
                    indeterminated={_.includes(indeterminateRoles, roleName)}
                    restrictions={this.processRestrictions(role)}
                    isRolePanelDisabled={!nodes.length}
                    onClick={() => selectRoles(roleName, !selected)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }
});

Role = React.createClass({
  getDefaultProps() {
    return {showPopoverTimeout: 800};
  },
  getInitialState() {
    return {
      isPopoverVisible: false,
      isPopoverForceHidden: false
    };
  },
  startCountdown() {
    this.popoverTimeout = _.delay(() => this.togglePopover(true), this.props.showPopoverTimeout);
  },
  stopCountdown() {
    if (this.popoverTimeout) clearTimeout(this.popoverTimeout);
    delete this.popoverTimeout;
  },
  resetCountdown() {
    if (!this.state.isPopoverForceHidden) {
      this.stopCountdown();
      this.startCountdown();
    }
  },
  forceHidePopover() {
    this.stopCountdown();
    this.setState({
      isPopoverVisible: false,
      isPopoverForceHidden: true
    });
  },
  togglePopover(isVisible) {
    this.stopCountdown();
    this.setState({
      isPopoverVisible: isVisible,
      isPopoverForceHidden: false
    });
  },
  onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.forceHidePopover();
      this.props.onClick();
    }
  },
  onClick() {
    ReactDOM.findDOMNode(this).blur();
    this.props.onClick();
  },
  render() {
    var {role, selected, indeterminated, restrictions, isRolePanelDisabled} = this.props;
    var isRoleAvailable = !restrictions.result;
    var disabled = !isRoleAvailable || isRolePanelDisabled;
    var {warnings} = restrictions;
    return (
      <div
        tabIndex={isRoleAvailable ? 0 : -1}
        className={utils.classNames({
          'role-block': true,
          [role.get('name')]: true,
          selected,
          indeterminated,
          unavailable: !isRoleAvailable
        })}
        onFocus={this.resetCountdown}
        onBlur={() => this.togglePopover(false)}
        onMouseEnter={this.startCountdown}
        onMouseMove={this.resetCountdown}
        onMouseLeave={() => this.togglePopover(false)}
        onKeyDown={!disabled && this.onKeyDown}
      >
        <div onClick={this.forceHidePopover}>
          <div className='role' onClick={!disabled && this.onClick}>
            <i
              className={utils.classNames({
                glyphicon: true,
                'glyphicon-selected-role': selected,
                'glyphicon-indeterminated-role': indeterminated && !warnings.length,
                'glyphicon-warning-sign': !!warnings.length
              })}
            />
            <span>{role.get('label')}</span>
          </div>
        </div>
        {this.state.isPopoverVisible &&
          <Popover placement='top'>
            <div>
              {_.map(warnings, (text, index) => <p key={index} className='text-warning'>{text}</p>)}
              {!!warnings.length && <hr />}
              <div>{role.get('description')}</div>
            </div>
          </Popover>
        }
      </div>
    );
  }
});

SelectAllMixin = {
  componentDidUpdate() {
    if (this.refs['select-all']) {
      var input = this.refs['select-all'].getInputDOMNode();
      input.indeterminate = !input.checked &&
        _.some(this.props.nodes, (node) => this.props.selectedNodeIds[node.id]);
    }
  },
  renderSelectAllCheckbox() {
    var {
      nodes, selectedNodeIds, maxNumberOfNodes, selectNodes, mode, locked, nodeActionsAvailable
    } = this.props;
    var nodesToSelect = nodeActionsAvailable ?
      nodes
    :
      _.filter(nodes, (node) => node.get('online'));
    var checked = mode === 'edit' ||
      nodesToSelect.length && !_.some(nodesToSelect, (node) => !selectedNodeIds[node.id]);
    return (
      <Input
        ref='select-all'
        name='select-all'
        type='checkbox'
        checked={checked}
        disabled={
          mode === 'edit' ||
          locked ||
          !nodesToSelect.length ||
          !checked && !_.isNull(maxNumberOfNodes) && maxNumberOfNodes < nodesToSelect.length
        }
        label={i18n('common.select_all')}
        wrapperClassName='select-all pull-right'
        onChange={_.partial(selectNodes, _.map(nodesToSelect, 'id'))}
      />
    );
  }
};

NodeList = React.createClass({
  mixins: [SelectAllMixin],
  groupNodes() {
    var uniqValueSorters = ['name', 'mac', 'ip'];

    var composeNodeDiskSizesLabel = function(node) {
      var diskSizes = node.resource('disks');
      return i18n('node_details.disks_amount', {
        count: diskSizes.length,
        size: diskSizes.map((size) => utils.showSize(size) + ' ' +
          i18n('node_details.hdd')).join(', ')
      });
    };

    var labelNs = 'cluster_page.nodes_tab.node_management_panel.labels.';
    var getLabelValue = (node, label) => {
      var labelValue = node.getLabel(label);
      return labelValue === false ?
          i18n(labelNs + 'not_assigned_label', {label: label})
        :
          _.isNull(labelValue) ?
            i18n(labelNs + 'not_specified_label', {label: label})
          :
            label + ' "' + labelValue + '"';
    };

    var groupingMethod = (node) => {
      return _.compact(_.map(this.props.activeSorters, (sorter) => {
        if (_.includes(uniqValueSorters, sorter.name)) return null;

        if (sorter.isLabel) return getLabelValue(node, sorter.name);

        var ns = 'cluster_page.nodes_tab.node.';
        var cluster = this.props.cluster || this.props.clusters.get(node.get('cluster'));
        var sorterNameFormatters = {
          roles: () => node.getRolesSummary(this.props.roles) || i18n(ns + 'no_roles'),
          status: () => {
            if (!node.get('online')) return i18n(ns + 'status.offline');
            return i18n(ns + 'status.' + node.get('status'), {
              os: cluster && cluster.get('release').get('operating_system') || 'OS'
            });
          },
          manufacturer: () => node.get('manufacturer') || i18n('common.not_specified'),
          group_id: () => {
            var nodeNetworkGroup = this.props.nodeNetworkGroups.get(node.get('group_id'));
            return nodeNetworkGroup && i18n(ns + 'node_network_group', {
              group: nodeNetworkGroup.get('name') +
                (this.props.cluster ? '' : ' (' + cluster.get('name') + ')')
            }) || i18n(ns + 'no_node_network_group');
          },
          cluster: () => cluster && i18n(
            ns + 'cluster',
            {cluster: cluster.get('name')}
          ) || i18n(ns + 'unallocated'),
          hdd: () => i18n(
            'node_details.total_hdd',
            {total: utils.showSize(node.resource('hdd'))}
          ),
          disks: () => composeNodeDiskSizesLabel(node),
          ram: () => i18n(
            'node_details.total_ram',
            {total: utils.showSize(node.resource('ram'))}
          ),
          interfaces: () => i18n(
            'node_details.interfaces_amount',
            {count: node.resource('interfaces')}
          ),
          default: () => i18n('node_details.' + sorter.name, {count: node.resource(sorter.name)})
        };
        return (sorterNameFormatters[sorter.name] || sorterNameFormatters.default)();
      })).join('; ');
    };
    var groups = _.toPairs(_.groupBy(this.props.nodes, groupingMethod));

    // sort grouped nodes by name, mac or ip
    var formattedSorters = _.compact(_.map(this.props.activeSorters, (sorter) => {
      if (_.includes(uniqValueSorters, sorter.name)) {
        return {attr: sorter.name, desc: sorter.order === 'desc'};
      }
    }));
    if (formattedSorters.length) {
      _.each(groups, (group) => {
        group[1].sort((node1, node2) =>
          utils.multiSort(node1, node2, formattedSorters)
        );
      });
    }

    // sort grouped nodes by other applied sorters
    var preferredRolesOrder = this.props.roles.map('name');
    return groups.sort((group1, group2) => {
      var result;
      _.each(this.props.activeSorters, (sorter) => {
        var node1 = group1[1][0];
        var node2 = group2[1][0];

        if (sorter.isLabel) {
          var node1Label = node1.getLabel(sorter.name);
          var node2Label = node2.getLabel(sorter.name);
          if (node1Label && node2Label) {
            result = utils.natsort(node1Label, node2Label, {insensitive: true});
          } else {
            result = node1Label === node2Label ? 0 : _.isString(node1Label) ? -1 :
              _.isNull(node1Label) ? -1 : 1;
          }
        } else {
          var comparators = {
            roles: () => {
              var roles1 = node1.sortedRoles(preferredRolesOrder);
              var roles2 = node2.sortedRoles(preferredRolesOrder);
              var order;
              if (!roles1.length && !roles2.length) {
                result = 0;
              } else if (!roles1.length) {
                result = 1;
              } else if (!roles2.length) {
                result = -1;
              } else {
                while (!order && roles1.length && roles2.length) {
                  order = _.indexOf(preferredRolesOrder, roles1.shift()) -
                    _.indexOf(preferredRolesOrder, roles2.shift());
                }
                result = order || roles1.length - roles2.length;
              }
            },
            status: () => {
              var status1 = !node1.get('online') ? 'offline' : node1.get('status');
              var status2 = !node2.get('online') ? 'offline' : node2.get('status');
              result = _.indexOf(this.props.statusesToFilter, status1) -
                _.indexOf(this.props.statusesToFilter, status2);
            },
            manufacturer: () => {
              result = utils.compare(node1, node2, {attr: sorter.name});
            },
            disks: () => {
              result = utils.natsort(composeNodeDiskSizesLabel(node1),
                composeNodeDiskSizesLabel(node2));
            },
            group_id: () => {
              var nodeGroup1 = node1.get('group_id');
              var nodeGroup2 = node2.get('group_id');
              result = nodeGroup1 === nodeGroup2 ? 0 :
                !nodeGroup1 ? 1 : !nodeGroup2 ? -1 : nodeGroup1 - nodeGroup2;
            },
            cluster: () => {
              var cluster1 = node1.get('cluster');
              var cluster2 = node2.get('cluster');
              result = cluster1 === cluster2 ? 0 :
                !cluster1 ? 1 : !cluster2 ? -1 :
                  utils.natsort(this.props.clusters.get(cluster1).get('name'),
                    this.props.clusters.get(cluster2).get('name'));
            },
            default: () => {
              result = node1.resource(sorter.name) - node2.resource(sorter.name);
            }
          };
          (comparators[sorter.name] || comparators.default)();
        }

        if (sorter.order === 'desc') {
          result = result * -1;
        }
        return !_.isUndefined(result) && !result;
      });
      return result;
    });
  },
  render() {
    var {mode, nodes, viewMode, processedRoleLimits, selectedRoles, totalNodesLength} = this.props;
    var groups = this.groupNodes();
    var rolesWithLimitReached = _.keys(_.omitBy(processedRoleLimits,
      (roleLimit, roleName) => roleLimit.valid || !_.includes(selectedRoles, roleName)
    ));
    return (
      <div className={utils.classNames({
        'node-list row': true,
        compact: viewMode === 'compact'
      })}>
        {groups.length > 1 &&
          <div className='col-xs-12 node-list-header'>
            {this.renderSelectAllCheckbox()}
          </div>
        }
        <div className='col-xs-12 content-elements'>
          {groups.map((group) => {
            return <NodeGroup {...this.props}
              key={group[0]}
              label={group[0]}
              nodes={group[1]}
              rolesWithLimitReached={rolesWithLimitReached}
            />;
          })}
          {totalNodesLength ?
            (
              !nodes.length &&
                <div className='alert alert-warning'>
                  {i18n('cluster_page.nodes_tab.no_filtered_nodes_warning')}
                </div>
            )
          :
            <div className='alert alert-warning'>
              {utils.renderMultilineText(
                i18n(
                  'cluster_page.nodes_tab.' + (
                    mode === 'add' ? 'no_nodes_in_fuel' : 'no_nodes_in_environment'
                  )
                )
              )}
            </div>
          }
        </div>
      </div>
    );
  }
});

NodeGroup = React.createClass({
  mixins: [SelectAllMixin],
  render() {
    var {
      label, nodes, cluster, locked, clusters,
      selectNodes, selectedNodeIds, rolesWithLimitReached, nodeActionsAvailable
    } = this.props;
    var availableNodes = nodes.filter((node) => node.isSelectable());
    var nodesWithRestrictionsIds = _.map(
      _.filter(availableNodes,
        (node) => _.some(rolesWithLimitReached, (role) => !node.hasRole(role))
      ),
      'id'
    );
    return (
      <div className='nodes-group'>
        <div className='row node-group-header'>
          <div className='col-xs-10'>
            <h4>{label} ({nodes.length})</h4>
          </div>
          <div className='col-xs-2'>
            {this.renderSelectAllCheckbox()}
          </div>
        </div>
        <div className='row'>
          {nodes.map((node) => {
            return <Node
              {... _.pick(this.props,
                'mode', 'viewMode', 'nodeNetworkGroups', 'nodeActionsAvailable'
              )}
              key={node.id}
              node={node}
              renderActionButtons={!!cluster}
              cluster={cluster || clusters.get(node.get('cluster'))}
              checked={selectedNodeIds[node.id]}
              locked={
                locked ||
                _.includes(nodesWithRestrictionsIds, node.id) ||
                !nodeActionsAvailable && !node.get('online')
              }
              onNodeSelection={_.partial(selectNodes, [node.id])}
            />;
          })}
        </div>
      </div>
    );
  }
});

export default NodeListScreen;
