/*
 * Copyright 2016 Mirantis, Inc.
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

import _ from 'underscore';
import React from 'react';
import {
  Sorter, Filter,
  NODE_STATUSES, NODE_LIST_SORTERS, NODE_LIST_FILTERS, NODE_VIEW_MODES
} from 'views/cluster_page_tabs/nodes_tab_screens/node_list_screen_objects';

export var nodeListMixin = {
  propTypes: {
    defaultFilters: React.PropTypes.object,
    statusesToFilter: React.PropTypes.arrayOf(React.PropTypes.string),
    availableFilters: React.PropTypes.arrayOf(React.PropTypes.string),
    defaultSorting: React.PropTypes.arrayOf(React.PropTypes.object),
    availableSorters: React.PropTypes.arrayOf(React.PropTypes.string)
  },
  getInitialState() {
    var {nodes, uiSettings} = this.props;

    var activeFilters, activeSorters, search, viewMode;
    if (uiSettings) {
      var {filter, filter_by_labels, sort, sort_by_labels} = uiSettings;
      activeFilters = _.union(
        Filter.fromObject(_.extend({}, this.props.defaultFilters, filter), false),
        Filter.fromObject(filter_by_labels, true)
      );
      activeSorters = _.union(
        _.map(sort, _.partial(Sorter.fromObject, _, false)),
        _.map(sort_by_labels, _.partial(Sorter.fromObject, _, true))
      );
      search = uiSettings.search;
      viewMode = uiSettings.view_mode;
    } else {
      activeFilters = Filter.fromObject(this.props.defaultFilters, false);
      activeSorters = _.map(this.props.defaultSorting, _.partial(Sorter.fromObject, _, false));
      search = '';
      viewMode = _.first(NODE_VIEW_MODES);
    }
    _.invokeMap(activeFilters, 'updateLimits', nodes, false);

    return {activeFilters, activeSorters, search, viewMode};
  },
  getNodeListProps() {
    var {nodes, availableSorters, availableFilters} = this.props;
    return _.defaults(
      _.pick(this, 'updateSearch', 'changeViewMode', 'updateSorting', 'updateFilters'),
      _.pick(this.state, 'activeFilters', 'activeSorters', 'search', 'viewMode'),
      _.pick(this.props, 'defaultFilters', 'defaultSorting', 'statusesToFilter'),
      {
        defaultSorting: [{status: 'asc'}],
        availableSorters: _.map(availableSorters || NODE_LIST_SORTERS,
          (name) => new Sorter(name, 'asc', false)
        ),
        statusesToFilter: NODE_STATUSES,
        defaultFilters: {status: []},
        availableFilters: _.map(availableFilters || NODE_LIST_FILTERS, (name) => {
          var filter = new Filter(name, [], false);
          filter.updateLimits(nodes, true);
          return filter;
        })
      }
    );
  },
  updateSearch(search) {
    this.setState({search});
    if (this.updateUISettings) {
      this.updateUISettings('search', _.trim(search));
    }
  },
  changeViewMode(viewMode) {
    this.setState({viewMode});
    if (this.updateUISettings) {
      this.updateUISettings('view_mode', viewMode);
    }
  },
  updateSorting(activeSorters, updateLabelsOnly = false) {
    this.setState({activeSorters});
    if (this.updateUISettings) {
      var groupedSorters = _.groupBy(activeSorters, 'isLabel');
      if (!updateLabelsOnly) {
        this.updateUISettings('sort', _.map(groupedSorters.false, Sorter.toObject));
      }
      this.updateUISettings('sort_by_labels', _.map(groupedSorters.true, Sorter.toObject));
    }
  },
  updateFilters(filters, updateLabelsOnly = false) {
    this.setState({activeFilters: filters});
    if (this.updateUISettings) {
      var groupedFilters = _.groupBy(filters, 'isLabel');
      if (!updateLabelsOnly) {
        this.updateUISettings('filter', Filter.toObject(groupedFilters.false));
      }
      this.updateUISettings('filter_by_labels', Filter.toObject(groupedFilters.true));
    }
  }
};

export var roleManagementMixin = {
  getInitialState() {
    var {cluster, nodes} = this.props;
    var roles = cluster.get('roles').pluck('name');
    var selectedRoles = _.filter(roles, (role) => nodes.every((node) => node.hasRole(role)));
    var indeterminateRoles = _.filter(roles,
      (role) => !_.includes(selectedRoles, role) && nodes.some((node) => node.hasRole(role))
    );
    var configModels = {
      cluster,
      settings: cluster.get('settings'),
      version: app.version,
      default: cluster.get('settings')
    };
    return {selectedRoles, indeterminateRoles, configModels};
  },
  getRoleProps() {
    return _.extend(
      {
        roles: this.props.cluster.get('roles'),
        selectRoles: this.selectRoles,
        showRolePanel: true
      },
      _.pick(this.state, 'selectedRoles', 'indeterminateRoles', 'configModels')
    );
  },
  selectRoles(role, checked) {
    var {selectedRoles, indeterminateRoles} = this.state;
    if (checked) {
      selectedRoles.push(role);
    } else {
      selectedRoles = _.without(selectedRoles, role);
    }
    indeterminateRoles = _.without(indeterminateRoles, role);
    this.setState({selectedRoles, indeterminateRoles});
  }
};
