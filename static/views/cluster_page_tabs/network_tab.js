/*
 * Copyright 2015 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License'); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS, WITHOUT
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
import {Link} from 'react-router';
import utils from 'utils';
import models from 'models';
import dispatcher from 'dispatcher';
import {CreateNodeNetworkGroupDialog, RemoveNodeNetworkGroupDialog} from 'views/dialogs';
import {backboneMixin, dispatcherMixin, unsavedChangesMixin, renamingMixin, loadPropsMixin}
  from 'component_mixins';
import {Input, Table, Popover, Tooltip, ProgressButton} from 'views/controls';
import customControls from 'views/custom_controls';
import SettingSection from 'views/cluster_page_tabs/setting_section';
import CSSTransitionGroup from 'react-addons-transition-group';

var parametersNS = 'cluster_page.network_tab.networking_parameters.';
var networkTabNS = 'cluster_page.network_tab.';

var NetworkModelManipulationMixin = {
  setValue(attribute, value, options) {
    function convertToStringIfNaN(value) {
      var convertedValue = parseInt(value, 10);
      return _.isNaN(convertedValue) ? '' : convertedValue;
    }
    if (options && options.isInteger && !_.isNull(value)) {
      // for ranges values
      if (_.isArray(value)) {
        value = _.map(value, convertToStringIfNaN);
      } else {
        value = convertToStringIfNaN(value);
      }
    }
    var networkConfiguration = this.props.cluster.get('networkConfiguration');
    this.getModel().set(attribute, value);
    dispatcher.trigger('hideNetworkVerificationResult');
    networkConfiguration.isValid({
      nodeNetworkGroups: this.props.cluster.get('nodeNetworkGroups')
    });
  },
  getModel() {
    return this.props.network ||
      this.props.cluster.get('networkConfiguration').get('networking_parameters');
  }
};

var NetworkInputsMixin = {
  composeProps(attribute, isRange, isInteger) {
    var {network, disabled, cluster, verificationErrorField} = this.props;
    var ns = network ? networkTabNS + 'network.' : parametersNS;

    var error = this.getError(attribute) || null;
    // in case of verification error we need to pass an empty string to highlight the field only
    // but not overwriting validation error
    if (!error && _.includes(verificationErrorField, attribute)) {
      error = '';
    }

    return {
      key: attribute,
      onChange: _.partialRight(this.setValue, {isInteger: isInteger}),
      name: attribute,
      label: i18n(ns + attribute),
      value: this.getModel().get(attribute),
      wrapperClassName: isRange ? attribute : false,
      network,
      cluster,
      disabled,
      error
    };
  },
  renderInput(attribute, isInteger, additionalProps = {}) {
    return (
      <Input
        {...additionalProps}
        {...this.composeProps(attribute, false, isInteger)}
        type='text'
        wrapperClassName={attribute}
      />
    );
  },
  getError(attribute) {
    var validationError = this.props.cluster.get('networkConfiguration').validationError;
    if (!validationError) return null;

    var error;
    if (this.props.network) {
      try {
        error = validationError
          .networks[this.props.currentNodeNetworkGroup.id][this.props.network.id][attribute];
      } catch (e) {}
      return error || null;
    }
    error = (validationError.networking_parameters || {})[attribute];
    if (!error) return null;

    // specific format needed for vlan_start error
    if (attribute === 'fixed_networks_vlan_start') return [error];

    return error;
  }
};

var NetworkRequirementsHelp = React.createClass({
  getInitialState() {
    return {isPopoverVisible: false};
  },
  toggleRequirementsPopover() {
    this.setState({isPopoverVisible: !this.state.isPopoverVisible});
  },
  render() {
    var requirements = utils.renderMultilineText(
      i18n('network.requirements.' + this.props.sectionName, {defaultValue: ''})
    );
    if (_.isEmpty(requirements)) return null;
    return (
      <div
        className='popover-container'
        onMouseEnter={this.toggleRequirementsPopover}
        onMouseLeave={this.toggleRequirementsPopover}
      >
        <i className='glyphicon tooltip-icon glyphicon-question-sign' />
        {this.state.isPopoverVisible &&
          <Popover placement='right' className='requirements-popover'>
            {requirements}
          </Popover>
        }
      </div>
    );
  }
});

var Range = React.createClass({
  mixins: [
    NetworkModelManipulationMixin
  ],
  getDefaultProps() {
    return {
      extendable: true,
      placeholder: '127.0.0.1',
      hiddenControls: false
    };
  },
  propTypes: {
    wrapperClassName: React.PropTypes.node,
    extendable: React.PropTypes.bool,
    name: React.PropTypes.string,
    autoIncreaseWith: React.PropTypes.number,
    integerValue: React.PropTypes.bool,
    placeholder: React.PropTypes.string,
    hiddenControls: React.PropTypes.bool,
    mini: React.PropTypes.bool
  },
  getInitialState() {
    return {elementToFocus: null};
  },
  componentDidUpdate() {
    // this glitch is needed to fix
    // when pressing '+' or '-' buttons button remains focused
    if (
      this.props.extendable &&
      this.state.elementToFocus &&
      this.getModel().get(this.props.name).length
    ) {
      $(this.refs[this.state.elementToFocus].getInputDOMNode()).focus();
      this.setState({elementToFocus: null});
    }
  },
  autoCompleteIPRange(error, rangeStart, event) {
    var input = event.target;
    if (input.value) return;
    if (_.isUndefined(error)) input.value = rangeStart;
    if (input.setSelectionRange) {
      var startPos = _.lastIndexOf(rangeStart, '.') + 1;
      var endPos = rangeStart.length;
      input.setSelectionRange(startPos, endPos);
    }
  },
  onRangeChange(name, newValue, attribute, rowIndex) {
    var model = this.getModel();
    var valuesToSet = _.cloneDeep(model.get(attribute));
    var valuesToModify = this.props.extendable ? valuesToSet[rowIndex] : valuesToSet;

    if (this.props.autoIncreaseWith) {
      valuesToSet = newValue;
    } else if (_.includes(name, 'range-start')) {
      // if first range field
      valuesToModify[0] = newValue;
    } else if (_.includes(name, 'range-end')) {
      // if end field
      valuesToModify[1] = newValue;
    }

    this.setValue(attribute, valuesToSet, {isInteger: this.props.integerValue});
  },
  addRange(attribute, rowIndex) {
    var newValue = _.clone(this.getModel().get(attribute));
    newValue.splice(rowIndex + 1, 0, ['', '']);
    this.setValue(attribute, newValue);
    this.setState({
      elementToFocus: 'start' + (rowIndex + 1)
    });
  },
  removeRange(attribute, rowIndex) {
    var newValue = _.clone(this.getModel().get(attribute));
    newValue.splice(rowIndex, 1);
    this.setValue(attribute, newValue);
    this.setState({
      elementToFocus: 'start' + _.min([newValue.length - 1, rowIndex])
    });
  },
  getRangeProps(isRangeEnd) {
    var error = this.props.error || null;
    var attributeName = this.props.name;
    return {
      type: 'text',
      placeholder: error ? '' : this.props.placeholder,
      className: 'form-control',
      disabled: this.props.disabled,
      onChange: _.partialRight(this.onRangeChange, attributeName),
      name: (isRangeEnd ? 'range-end_' : 'range-start_') + attributeName
    };
  },
  renderRangeControls(attributeName, index, length) {
    return (
      <div className='ip-ranges-control'>
        <button
          className='btn btn-link ip-ranges-add'
          disabled={this.props.disabled}
          onClick={_.partial(this.addRange, attributeName, index)}
        >
          <i className='glyphicon glyphicon-plus-sign'></i>
        </button>
        {(length > 1) &&
          <button
            className='btn btn-link ip-ranges-delete'
            disabled={this.props.disabled}
            onClick={_.partial(this.removeRange, attributeName, index)}
          >
            <i className='glyphicon glyphicon-minus-sign'></i>
          </button>
        }
      </div>
    );
  },
  renderExtendableRanges(options) {
    var {error, attributeName, ranges, verificationError} = options;
    return _.map(ranges, (range, index) => {
      var rangeError = _.find(error, {index}) || {};
      return (
        <div className='range-row clearfix' key={index}>
          <Input
            {...this.getRangeProps()}
            error={(rangeError.start || verificationError) ? '' : null}
            value={range[0]}
            onChange={_.partialRight(this.onRangeChange, attributeName, index)}
            ref={'start' + index}
            inputClassName='start'
            placeholder={rangeError.start ? '' : this.props.placeholder}
          />
          <Input
            {...this.getRangeProps(true)}
            error={rangeError.end ? '' : null}
            value={range[1]}
            onChange={_.partialRight(this.onRangeChange, attributeName, index)}
            onFocus={_.partial(this.autoCompleteIPRange, rangeError && rangeError.start, range[0])}
            disabled={this.props.disabled || !!this.props.autoIncreaseWith}
            placeholder={rangeError.end ? '' : this.props.placeholder}
            extraContent={
              !this.props.hiddenControls &&
              this.renderRangeControls(attributeName, index, ranges.length)
            }
          />
          <div className='validation-error text-danger pull-left'>
            <span className='help-inline'>
              {rangeError.start || rangeError.end}
            </span>
          </div>
        </div>
      );
    });
  },
  renderRanges(options) {
    var {error, ranges, startInputError, endInputError} = options;
    return (
      <div className='range-row clearfix'>
        <Input
          {...this.getRangeProps()}
          value={ranges[0]}
          error={startInputError ? '' : null}
          inputClassName='start'
        />
        <Input
          {...this.getRangeProps(true)}
          disabled={this.props.disabled || !!this.props.autoIncreaseWith}
          value={ranges[1]}
          error={endInputError ? '' : null}
        />
        {error && (startInputError || endInputError) &&
          <div className='validation-error text-danger pull-left'>
            <span className='help-inline'>{startInputError || endInputError}</span>
          </div>
        }
      </div>
    );
  },
  render() {
    var error = this.props.error || null;
    var attributeName = this.props.name;
    var attribute = this.getModel().get(attributeName);
    var ranges = this.props.autoIncreaseWith ?
      [attribute || 0, (attribute + this.props.autoIncreaseWith - 1 || 0)] :
      attribute;
    var wrapperClasses = {
      'form-group range row': true,
      mini: this.props.mini,
      [this.props.wrapperClassName]: this.props.wrapperClassName
    };
    var verificationError = this.props.verificationError || null;
    var [startInputError, endInputError] = error || [];

    wrapperClasses[this.props.wrapperClassName] = this.props.wrapperClassName;
    return (
      <div className={utils.classNames(wrapperClasses)}>
        {!this.props.hiddenHeader &&
          <div className='range-row-header col-xs-12'>
            <div>{i18n(networkTabNS + 'range_start')}</div>
            <div>{i18n(networkTabNS + 'range_end')}</div>
          </div>
        }
        <div className='col-xs-12'>
          <label>{this.props.label}</label>
          {
            // TODO: renderExtendableRanges & renderRanges methods
            // should be refactored to avoid copy-paste
            this.props.extendable ?
              this.renderExtendableRanges({error, attributeName, ranges, verificationError})
            :
              this.renderRanges({error, ranges, startInputError, endInputError})
          }
        </div>
      </div>
    );
  }
});

var VlanTagInput = React.createClass({
  mixins: [NetworkModelManipulationMixin],
  getInitialState() {
    return {pendingFocus: false};
  },
  componentDidUpdate() {
    var {name, value} = this.props;
    if (!_.isNull(value) && this.state.pendingFocus) {
      $(this.refs[name].getInputDOMNode()).focus();
      this.setState({pendingFocus: false});
    }
  },
  onTaggingChange(attribute, value) {
    this.setValue(attribute, value ? '' : null);
    this.setState({pendingFocus: true});
  },
  onInputChange(attribute, value) {
    this.setValue(attribute, value, {isInteger: true});
  },
  render() {
    var {name, label, value, disabled, configurationTemplateExists} = this.props;
    return (
      <div className={utils.classNames('vlan-tagging form-group', name)}>
        <label className='vlan-tag-label'>
          {label}
          {!disabled && configurationTemplateExists &&
            <Tooltip
              text={i18n('cluster_page.network_tab.network.locked_vlan_change')}
              placement='right'
            >
              <i className='glyphicon tooltip-icon glyphicon-warning-sign' />
            </Tooltip>
          }
        </label>
        <Input {...this.props}
          onChange={this.onTaggingChange}
          type='checkbox'
          checked={!_.isNull(value)}
          disabled={disabled || configurationTemplateExists}
          error={null}
          label={null}
        />
        {!_.isNull(value) &&
          <Input {...this.props}
            ref={name}
            onChange={this.onInputChange}
            type='text'
            label={null}
            disabled={disabled || configurationTemplateExists}
          />
        }
      </div>
    );
  }
});

var CidrControl = React.createClass({
  mixins: [NetworkModelManipulationMixin],
  onCidrChange(name, cidr) {
    this.props.onChange(name, cidr);
    if (this.props.network.get('meta').notation === 'cidr') {
      this.props.autoUpdateParameters(cidr);
    }
  },
  render() {
    return (
      <div className='form-group cidr'>
        <label>{i18n(networkTabNS + 'network.cidr')}</label>
        <Input
          {...this.props}
          type='text'
          label={null}
          onChange={this.onCidrChange}
          wrapperClassName='pull-left'
        />
        <Input
          type='checkbox'
          checked={this.props.network.get('meta').notation === 'cidr'}
          label={i18n(networkTabNS + 'network.use_whole_cidr')}
          disabled={this.props.disabled}
          onChange={this.props.changeNetworkNotation}
          wrapperClassName='pull-left'
        />
      </div>
    );
  }
});

var NetworkTab = React.createClass({
  mixins: [
    NetworkInputsMixin,
    NetworkModelManipulationMixin,
    backboneMixin('cluster', 'change:status'),
    backboneMixin({
      modelOrCollection(props) {
        return props.cluster.get('nodeNetworkGroups');
      },
      renderOn: 'change update'
    }),
    backboneMixin({
      modelOrCollection(props) {
        return props.cluster.get('networkConfiguration').get('networking_parameters');
      }
    }),
    backboneMixin({
      modelOrCollection(props) {
        return props.cluster.get('networkConfiguration').get('networks');
      },
      renderOn: 'change reset update'
    }),
    backboneMixin({
      modelOrCollection(props) {
        return props.cluster.get('tasks');
      },
      renderOn: 'update change:status'
    }),
    dispatcherMixin('hideNetworkVerificationResult', function() {
      this.setState({hideVerificationResult: true});
    }),
    dispatcherMixin('networkConfigurationUpdated', function() {
      this.setState({hideVerificationResult: false});
    }),
    backboneMixin({
      modelOrCollection(props) {
        return props.cluster.get('settings');
      },
      renderOn: 'change invalid'
    }),
    unsavedChangesMixin,
    loadPropsMixin
  ],
  statics: {
    breadcrumbsPath() {
      return [
        [i18n('cluster_page.tabs.network'), null, {active: true}]
      ];
    },
    fetchData() {
      var {cluster} = app;
      if (!cluster) {
        return Promise.resolve();
      }
      return Promise.all([
        cluster.get('settings').fetch({cache: true}),
        cluster.get('networkConfiguration').fetch({cache: true})
      ]);
    },
    getSubtabs(props) {
      var {cluster, showAllNetworks} = props;
      var nodeNetworkGroups = cluster.get('nodeNetworkGroups');
      var nodeNetworkGroupSubtabs = showAllNetworks && nodeNetworkGroups.length !== 1 ?
          ['group/all']
        :
          nodeNetworkGroups.map((nodeNetworkGroup) => 'group/' + nodeNetworkGroup.id);
      return nodeNetworkGroupSubtabs
        .concat(['neutron_l2', 'neutron_l3', 'network_settings', 'network_verification']);
    },
    checkSubroute(props) {
      var {activeTab, showAllNetworks} = props;
      var {section, groupId, id} = props.params;

      if (activeTab === 'network') {
        // calculate showAllNetworks state
        if (!showAllNetworks && groupId === 'all') {
          showAllNetworks = true;
        }
        if (showAllNetworks && section === 'group' && groupId !== 'all') {
          showAllNetworks = false;
        }
      }

      // calculate section state
      var subtabs = this.getSubtabs(_.extend({}, props, {showAllNetworks}));

      if (activeTab === 'network') {
        var subroute = _.compact([section, groupId]).join('/');
        // check if current subroute is valid
        if (!subroute || !_.includes(subtabs, subroute)) {
          app.setPath('/cluster/' + id + '/network/' + subtabs[0]);
        }
        return {activeNetworkSectionName: subroute, showAllNetworks};
      }
      return {activeNetworkSectionName: subtabs[0], showAllNetworks};
    }
  },
  getInitialState() {
    var settings = this.props.cluster.get('settings');
    var networkConfiguration = this.props.cluster.get('networkConfiguration');
    return {
      configModels: {
        cluster: this.props.cluster,
        settings: settings,
        networking_parameters: networkConfiguration.get('networking_parameters'),
        version: app.version,
        release: this.props.cluster.get('release'),
        default: settings
      },
      initialSettingsAttributes: _.cloneDeep(settings.attributes),
      settingsForChecks: new models.Settings(_.cloneDeep(settings.attributes)),
      initialConfiguration: _.cloneDeep(networkConfiguration.toJSON()),
      hideVerificationResult: false
    };
  },
  validateNetworkConfiguration() {
    this.props.cluster.get('networkConfiguration').isValid({
      nodeNetworkGroups: this.props.cluster.get('nodeNetworkGroups')
    });
  },
  componentDidMount() {
    this.validateNetworkConfiguration();
    this.props.cluster.get('settings').isValid({models: this.state.configModels});
    this.props.cluster.get('tasks').on(
      'change:status change:unsaved',
      this.destroyUnsavedNetworkVerificationTask,
      this
    );
  },
  componentWillUnmount() {
    this.loadInitialConfiguration();
    this.props.cluster.get('tasks').off(null, this.destroyUnsavedNetworkVerificationTask, this);
    this.removeUnsavedTasks();
  },
  destroyUnsavedNetworkVerificationTask(task) {
    // FIXME(vkramskikh): remove tasks which we marked as "unsaved" hacky flag
    // immediately after completion, so they won't be taken into account when
    // we determine cluster verification status. They need to be removed silently
    // and kept in the collection to show verification result to the user
    if (task.match({group: 'network', active: false}) && task.get('unsaved')) {
      task.destroy({silent: true});
      task.unset('id'); // hack to prevent issuing another DELETE requests after actual removal
      this.props.cluster.get('tasks').add(task, {silent: true});
    }
  },
  removeUnsavedTasks() {
    var clusterTasks = this.props.cluster.get('tasks');
    clusterTasks.each((task) => task.get('unsaved') &&
      task.match({active: false}) && clusterTasks.remove(task));
  },
  isNetworkConfigurationChanged() {
    return !_.isEqual(
      this.state.initialConfiguration,
      this.props.cluster.get('networkConfiguration').toJSON()
    );
  },
  isNetworkSettingsChanged() {
    return this.props.cluster.get('settings').hasChanges(
      this.state.initialSettingsAttributes,
      this.state.configModels
    );
  },
  hasChanges() {
    return this.isNetworkConfigurationChanged() || this.isNetworkSettingsChanged();
  },
  revertChanges() {
    this.loadInitialConfiguration();
    this.loadInitialSettings();
    this.validateNetworkConfiguration();
    this.setState({
      hideVerificationResult: true,
      key: _.now()
    });
  },
  loadInitialConfiguration() {
    var networkConfiguration = this.props.cluster.get('networkConfiguration');
    networkConfiguration.get('networks').reset(
      _.cloneDeep(this.state.initialConfiguration.networks)
    );
    networkConfiguration.get('networking_parameters').set(
      _.cloneDeep(this.state.initialConfiguration.networking_parameters)
    );
  },
  loadInitialSettings() {
    var settings = this.props.cluster.get('settings');
    settings.set(_.cloneDeep(this.state.initialSettingsAttributes), {silent: true});
    settings.mergePluginSettings();
    settings.isValid({models: this.state.configModels});
  },
  updateInitialConfiguration() {
    this.setState({
      initialConfiguration: _.cloneDeep(this.props.cluster.get('networkConfiguration').toJSON())
    });
  },
  isLocked() {
    return !this.props.cluster.isAvailableForSettingsChanges() ||
      !!this.props.cluster.task({group: 'network', active: true}) ||
      this.state.actionInProgress;
  },
  prepareIpRanges() {
    var removeEmptyRanges = (ranges) => {
      return _.filter(ranges, (range) => _.compact(range).length);
    };
    var networkConfiguration = this.props.cluster.get('networkConfiguration');
    networkConfiguration.get('networks').each((network) => {
      if (network.get('meta').notation === 'ip_ranges') {
        network.set({ip_ranges: removeEmptyRanges(network.get('ip_ranges'))});
      }
    });
    var floatingRanges = networkConfiguration.get('networking_parameters').get('floating_ranges');
    if (floatingRanges) {
      networkConfiguration.get('networking_parameters').set({
        floating_ranges: removeEmptyRanges(floatingRanges)
      });
    }
  },
  verifyNetworks() {
    this.setState({actionInProgress: true});
    this.prepareIpRanges();
    dispatcher.trigger('networkConfigurationUpdated', this.startVerification);
  },
  startVerification() {
    var networkConfiguration = this.props.cluster.get('networkConfiguration');
    var task = new models.Task();
    var options = {
      method: 'PUT',
      url: _.result(networkConfiguration, 'url') + '/verify',
      data: JSON.stringify(networkConfiguration)
    };
    var ns = networkTabNS + 'verify_networks.verification_error.';

    task.save({}, options)
      .then(
        () => this.props.cluster.fetchRelated('tasks'),
        (response) => {
          this.setState({actionInProgress: false});
          utils.showErrorDialog({
            title: i18n(ns + 'title'),
            message: i18n(ns + 'start_verification_warning'),
            response: response
          });
        }
      )
      .then(() => {
        // FIXME(vkramskikh): this ugly hack is needed to distinguish
        // verification tasks for saved config from verification tasks
        // for unsaved config (which appear after clicking "Verify"
        // button without clicking "Save Changes" button first).
        // For proper implementation, this should be managed by backend
        this.props.cluster.get('tasks').get(task.id).set('unsaved', this.hasChanges());
        this.setState({actionInProgress: false});
        dispatcher.trigger('networkVerificationTaskStarted');
        return Promise.resolve();
      });
  },
  isDiscardingPossible() {
    return !this.props.cluster.task({group: 'network', active: true});
  },
  applyChanges() {
    if (!this.isSavingPossible()) return Promise.reject();
    this.setState({actionInProgress: 'apply_changes'});
    this.prepareIpRanges();

    var requests = [];

    dispatcher.trigger('networkConfigurationUpdated', () => {
      var promise = Backbone.sync('update', this.props.cluster.get('networkConfiguration'))
        .then(() => {
          this.updateInitialConfiguration();
          this.setState({actionInProgress: false});
        }, (response) => {
          this.props.cluster.fetchRelated('tasks')
            .then(() => {
              // FIXME (morale): this hack is needed until backend response
              // format is unified https://bugs.launchpad.net/fuel/+bug/1521661
              var checkNetworksTask = this.props.cluster.task('check_networks');
              if (!(checkNetworksTask && checkNetworksTask.get('message'))) {
                var fakeTask = new models.Task({
                  cluster: this.props.cluster.id,
                  message: utils.getResponseText(response),
                  status: 'error',
                  name: 'check_networks',
                  result: {}
                });
                this.props.cluster.get('tasks').remove(checkNetworksTask);
                this.props.cluster.get('tasks').add(fakeTask);
              }
              // FIXME(vkramskikh): the same hack for check_networks task:
              // remove failed tasks immediately, so they won't be taken into account
              this.props.cluster.task('check_networks').set('unsaved', true);
              this.setState({actionInProgress: false});
            });
          return Promise.reject();
        });
      requests.push(promise);
      return promise;
    });

    if (this.isNetworkSettingsChanged()) {
      var settings = this.props.cluster.get('settings');
      var promise = settings.save(null, {patch: true, wait: true, validate: false});
      if (promise) {
        this.setState({actionInProgress: true});
        promise
          .then(
            () => {
              this.setState({
                initialSettingsAttributes: _.cloneDeep(settings.attributes),
                actionInProgress: false,
                key: _.now()
              });
              this.props.cluster.fetch();
            },
            (response) => {
              this.setState({
                actionInProgress: false,
                key: _.now()
              });
              this.props.cluster.fetch();
              utils.showErrorDialog({
                title: i18n('cluster_page.settings_tab.settings_error.title'),
                message: i18n('cluster_page.settings_tab.settings_error.saving_warning'),
                response: response
              });
            }
          );
        requests.push(promise);
      }
    }

    return Promise.all(requests);
  },
  isSavingPossible() {
    // not network related settings should not block saving of changes on Networks tab
    var settings = this.props.cluster.get('settings');
    var areNetworkSettingsValid = !_.some(settings.validationError, (error, path) => {
      return settings.get(utils.makePath(path.split('.')[0], 'metadata')).group === 'network' ||
        settings.get(path).group === 'network';
    });

    return !this.state.actionInProgress &&
      this.props.cluster.isAvailableForSettingsChanges() &&
      this.hasChanges() &&
      _.isNull(this.props.cluster.get('networkConfiguration').validationError) &&
      areNetworkSettingsValid;
  },
  loadDeployedSettings() {
    var {cluster} = this.props;

    cluster.get('networkConfiguration').updateEditableAttributes(
      cluster.get('deployedNetworkConfiguration'),
      cluster.get('nodeNetworkGroups')
    );

    cluster.get('settings').updateAttributes(
      cluster.get('deployedSettings'),
      this.state.configModels,
      true
    );

    this.setState({
      hideVerificationResult: true,
      key: _.now()
    });
  },
  renderButtons() {
    var {cluster} = this.props;
    var locked = this.isLocked();
    return (
      <div className='well clearfix'>
        <div className='btn-group pull-right'>
          <button
            key='revert_changes'
            className='btn btn-default btn-revert-changes'
            onClick={this.revertChanges}
            disabled={locked || !this.hasChanges()}
          >
            {i18n('common.cancel_changes_button')}
          </button>
          <ProgressButton
            key='apply_changes'
            className='btn btn-success apply-btn'
            onClick={this.applyChanges}
            disabled={!this.isSavingPossible()}
            progress={this.state.actionInProgress === 'apply_changes'}
          >
            {i18n('common.save_settings_button')}
          </ProgressButton>
        </div>
        <div className='btn-group pull-right'>
          {cluster.get('status') !== 'new' &&
            !_.isEmpty(cluster.get('deployedSettings').attributes) &&
            !_.isEmpty(cluster.get('deployedNetworkConfiguration').attributes) &&
            <button
              className='btn btn-default btn-load-deployed'
              onClick={this.loadDeployedSettings}
              disabled={locked}
            >
              {i18n('common.load_deployed_button')}
            </button>
          }
        </div>
      </div>
    );
  },
  getVerificationErrors() {
    var task = this.state.hideVerificationResult ? null :
      this.props.cluster.task({group: 'network', status: 'error'});
    var fieldsWithVerificationErrors = [];
    // @TODO(morale): soon response format will be changed and this part should be rewritten
    if (task && task.get('result').length) {
      _.each(task.get('result'), (verificationError) => {
        _.each(verificationError.ids, (networkId) => {
          _.each(verificationError.errors, (field) => {
            fieldsWithVerificationErrors.push({network: networkId, field: field});
          });
        });
      });
    }
    return fieldsWithVerificationErrors;
  },
  removeNodeNetworkGroup(nodeNetworkGroup) {
    var nodeNetworkGroups = this.props.cluster.get('nodeNetworkGroups');
    RemoveNodeNetworkGroupDialog
      .show({
        showUnsavedChangesWarning: this.hasChanges()
      })
      .then(() => {
        return nodeNetworkGroup
          .destroy({wait: true})
          .then(
            () => Promise.all([
              nodeNetworkGroups.fetch(),
              this.props.cluster.get('networkConfiguration').fetch()
            ]),
            (response) => utils.showErrorDialog({
              title: i18n(networkTabNS + 'node_network_group_deletion_error'),
              response: response
            })
          )
          .then(() => {
            this.validateNetworkConfiguration();
            this.updateInitialConfiguration();
            var defaultSubtab = this.constructor.getSubtabs(this.props)[0];
            app.setPath('/cluster/' + this.props.cluster.id + '/network/' + defaultSubtab);
          });
      });
  },
  addNodeNetworkGroup(hasChanges) {
    var nodeNetworkGroups = this.props.cluster.get('nodeNetworkGroups');
    if (hasChanges) {
      utils.showErrorDialog({
        title: i18n(networkTabNS + 'node_network_group_creation_error'),
        message: <div>
          <i className='glyphicon glyphicon-danger-sign' />
          {' '}
          {i18n(networkTabNS + 'save_changes_warning')}
        </div>
      });
      return;
    }
    CreateNodeNetworkGroupDialog
      .show({
        clusterId: this.props.cluster.id,
        nodeNetworkGroups: nodeNetworkGroups
      })
      .then(() => {
        this.setState({hideVerificationResult: true});
        var newNodeNetworkGroupId;
        return nodeNetworkGroups.fetch()
          .then(() => {
            newNodeNetworkGroupId = nodeNetworkGroups.last().id;
            return this.props.cluster.get('networkConfiguration').fetch();
          })
          .then(() => {
            this.updateInitialConfiguration();
            if (!this.props.showAllNetworks) {
              app.setPath(
                '/cluster/' + this.props.cluster.id + '/network/group/' + newNodeNetworkGroupId
              );
            }
          });
      });
  },
  onShowAllNetworksChange(name, value) {
    var navigationUrl = '/cluster/' + this.props.cluster.id + '/network/group/' + (
      value ?
        'all'
      :
        this.props.cluster.get('nodeNetworkGroups').find({is_default: true}).id
    );
    app.setPath(navigationUrl);
  },
  render() {
    var isLocked = this.isLocked();
    var hasChanges = this.hasChanges();
    var {cluster, showAllNetworks} = this.props;
    var {section, groupId} = this.props.params;
    var nodeNetworkGroups = cluster.get('nodeNetworkGroups');
    var networkConfiguration = this.props.cluster.get('networkConfiguration');
    var networkingParameters = networkConfiguration.get('networking_parameters');
    var classes = {
      row: true,
      'changes-locked': isLocked
    };
    var networks = networkConfiguration.get('networks');
    var isMultiRack = nodeNetworkGroups.length > 1;
    var networkVerifyTask = cluster.task('verify_networks');
    var networkCheckTask = cluster.task('check_networks');

    var {validationError} = networkConfiguration;
    var notEnoughNodesForVerification = cluster.get('nodes').filter({online: true}).length < 2;
    var isVerificationInProgress = !!cluster.task({group: ['network'], active: true});
    var isDeploymentInProgress = !!cluster.task({group: ['deployment'], active: true});
    var isVerificationDisabled = validationError ||
      this.state.actionInProgress ||
      isVerificationInProgress ||
      isDeploymentInProgress ||
      isMultiRack ||
      notEnoughNodesForVerification;

    var configurationTemplateExists = !_.isEmpty(
      networkingParameters.get('configuration_template')
    );

    var currentNodeNetworkGroup = nodeNetworkGroups.get(groupId);
    var nodeNetworkGroupProps = {
      cluster,
      validationError,
      nodeNetworkGroups,
      configurationTemplateExists,
      locked: isLocked,
      actionInProgress: this.state.actionInProgress,
      verificationErrors: this.getVerificationErrors(),
      removeNodeNetworkGroup: this.removeNodeNetworkGroup
    };
    return (
      <div className={utils.classNames(classes)}>
        <div className='col-xs-12'>
          <div className='row'>
            <div className='title col-xs-6'>
              {i18n(networkTabNS + 'title')}
              <div className='forms-box segmentation-type'>
                {'(' + i18n('common.network.neutron_' +
                  networkingParameters.get('segmentation_type')) + ')'}
              </div>
            </div>
            <div className='col-xs-6 node-network-groups-controls'>
              <button
                key='add_node_group'
                className='btn btn-success add-nodegroup-btn pull-right'
                onClick={_.partial(this.addNodeNetworkGroup, hasChanges)}
                disabled={
                  !!cluster.task({group: ['deployment', 'network'], active: true}) ||
                  this.state.actionInProgress
                }
              >
                <i
                  className={utils.classNames(
                    'glyphicon', hasChanges ? 'glyphicon-danger-sign' : 'glyphicon-plus-white'
                  )}
                />
                {i18n(networkTabNS + 'add_node_network_group')}
              </button>
              {isMultiRack &&
                <Input
                  type='checkbox'
                  key='show_all'
                  inputClassName='show-all-networks'
                  wrapperClassName='show-all-networks-wrapper'
                  onChange={this.onShowAllNetworksChange}
                  checked={showAllNetworks}
                  label={i18n(networkTabNS + 'show_all_networks')}
                />
              }
            </div>
          </div>
        </div>
        <div className='network-tab-content col-xs-12'>
          <div className='row'>
            <NetworkSubtabs
              cluster={cluster}
              subtabs={this.constructor.getSubtabs({
                cluster, nodeNetworkGroups, showAllNetworks
              })}
              validationError={validationError}
              nodeNetworkGroups={nodeNetworkGroups}
              activeGroupName={_.compact([section, groupId]).join('/')}
              isMultiRack={isMultiRack}
              hasChanges={hasChanges}
              showVerificationResult={!this.state.hideVerificationResult}
              showAllNetworks={showAllNetworks}
            />
            <div className='col-xs-10' key={this.state.key}>
              {section === 'group/all' &&
                nodeNetworkGroups.map((nodeNetworkGroup) => {
                  return <NodeNetworkGroup
                    key={nodeNetworkGroup.id}
                    {...nodeNetworkGroupProps}
                    nodeNetworkGroup={nodeNetworkGroup}
                    networks={networks.filter({group_id: nodeNetworkGroup.id})}
                  />;
                })
              }
              {currentNodeNetworkGroup &&
                <NodeNetworkGroup
                  {...nodeNetworkGroupProps}
                  nodeNetworkGroup={currentNodeNetworkGroup}
                  networks={networks.filter({group_id: currentNodeNetworkGroup.id})}
                />
              }
              {section === 'network_settings' &&
                <NetworkSettings
                  {... _.pick(this.state, 'configModels', 'settingsForChecks')}
                  cluster={this.props.cluster}
                  locked={isLocked}
                  initialAttributes={this.state.initialSettingsAttributes}
                />
              }
              {section === 'network_verification' &&
                <NetworkVerificationResult
                  key='network_verification'
                  task={networkVerifyTask}
                  networks={networks}
                  hideVerificationResult={this.state.hideVerificationResult}
                  isMultirack={isMultiRack}
                  isVerificationDisabled={isVerificationDisabled}
                  isVerificationInProgress={isVerificationInProgress}
                  notEnoughNodes={notEnoughNodesForVerification}
                  verifyNetworks={this.verifyNetworks}
                  actionInProgress={this.state.actionInProgress}
                />
              }
              {section === 'neutron_l2' &&
                <NetworkingL2Parameters
                  cluster={cluster}
                  validationError={validationError}
                  disabled={isLocked}
                />
              }
              {section === 'neutron_l3' &&
                <NetworkingL3Parameters
                  cluster={cluster}
                  validationError={validationError}
                  disabled={isLocked}
                />
              }
            </div>
          </div>
        </div>
        {!this.state.hideVerificationResult && networkCheckTask &&
          networkCheckTask.match({status: 'error'}) &&
          <div className='col-xs-12'>
            <div className='alert alert-danger enable-selection col-xs-12 network-alert'>
              {utils.renderMultilineText(networkCheckTask.get('message'))}
            </div>
          </div>
        }
        <div className='col-xs-12 page-buttons content-elements'>
          {this.renderButtons()}
        </div>
      </div>
    );
  }
});

var NodeNetworkGroup = React.createClass({
  render() {
    var {
      cluster, networks, nodeNetworkGroup, verificationErrors, validationError, locked,
      configurationTemplateExists
    } = this.props;
    return (
      <div>
        <NodeNetworkGroupTitle
          {... _.pick(this.props, 'cluster', 'removeNodeNetworkGroup')}
          currentNodeNetworkGroup={nodeNetworkGroup}
          isRenamingPossible={!locked}
          isDeletionPossible={!locked}
        />
        {networks.map((network) => {
          return (
            <Network
              key={network.id}
              network={network}
              cluster={cluster}
              validationError={(validationError || {}).networks}
              disabled={locked}
              configurationTemplateExists={configurationTemplateExists}
              verificationErrorField={
                _.map(_.filter(verificationErrors, {network: network.id}), 'field')
              }
              currentNodeNetworkGroup={nodeNetworkGroup}
            />
          );
        })}
      </div>
    );
  }
});

var NodeNetworkGroupTitle = React.createClass({
  mixins: [
    renamingMixin('node-group-title-input')
  ],
  onNodeNetworkGroupNameKeyDown(e) {
    this.setState({nodeNetworkGroupNameChangingError: null});
    if (e.key === 'Enter') {
      this.setState({actionInProgress: true});
      var element = this.refs['node-group-title-input'].getInputDOMNode();
      var newName = _.trim(element.value);
      var currentNodeNetworkGroup = this.props.currentNodeNetworkGroup;

      if (newName !== currentNodeNetworkGroup.get('name')) {
        var validationError = currentNodeNetworkGroup.validate({name: newName});
        if (validationError) {
          this.setState({
            nodeNetworkGroupNameChangingError: validationError,
            actionInProgress: false
          });
          element.focus();
        } else {
          currentNodeNetworkGroup
            .save({name: newName}, {validate: false})
            .then(
              this.endRenaming,
              (response) => {
                this.setState({
                  nodeNetworkGroupNameChangingError: utils.getResponseText(response)
                });
                element.focus();
              }
            );
        }
      } else {
        this.endRenaming();
      }
    } else if (e.key === 'Escape') {
      this.endRenaming();
      e.stopPropagation();
      ReactDOM.findDOMNode(this).focus();
    }
  },
  startNodeNetworkGroupRenaming(e) {
    this.setState({nodeNetworkGroupNameChangingError: null});
    this.startRenaming(e);
  },
  render() {
    var {currentNodeNetworkGroup, isRenamingPossible, isDeletionPossible} = this.props;
    var classes = {
      'network-group-name': true,
      'no-rename': !isRenamingPossible
    };
    return (
      <div
        className={utils.classNames(classes)}
        key={currentNodeNetworkGroup.id}
        data-name={currentNodeNetworkGroup.get('name')}
      >
        {this.state.isRenaming ?
          <Input
            type='text'
            ref='node-group-title-input'
            name='new-name'
            defaultValue={currentNodeNetworkGroup.get('name')}
            error={this.state.nodeNetworkGroupNameChangingError}
            disabled={this.state.actionInProgress}
            onKeyDown={this.onNodeNetworkGroupNameKeyDown}
            wrapperClassName='node-group-renaming clearfix'
            maxLength='50'
            selectOnFocus
            autoFocus
          />
        :
          <div className='name' onClick={isRenamingPossible && this.startNodeNetworkGroupRenaming}>
            <button className='btn-link'>{currentNodeNetworkGroup.get('name')}</button>
            {isRenamingPossible && <i className='glyphicon glyphicon-pencil' />}
          </div>
        }
        {isDeletionPossible && (
          currentNodeNetworkGroup.get('is_default') ?
            <span className='explanation'>
              {i18n(networkTabNS + 'default_node_network_group_info')}
            </span>
          :
            !this.state.isRenaming &&
              <i
                className='glyphicon glyphicon-remove-alt'
                onClick={() => this.props.removeNodeNetworkGroup(currentNodeNetworkGroup)}
              />
        )}
      </div>
    );
  }
});

var Network = React.createClass({
  mixins: [
    NetworkInputsMixin,
    NetworkModelManipulationMixin
  ],
  autoUpdateParameters(cidr) {
    var useGateway = this.props.network.get('meta').use_gateway;
    if (useGateway) this.setValue('gateway', utils.getDefaultGatewayForCidr(cidr));
    this.setValue('ip_ranges', utils.getDefaultIPRangeForCidr(cidr, useGateway));
  },
  changeNetworkNotation(name, value) {
    var meta = _.clone(this.props.network.get('meta'));
    meta.notation = value ? 'cidr' : 'ip_ranges';
    this.setValue('meta', meta);
    if (value) this.autoUpdateParameters(this.props.network.get('cidr'));
  },
  render() {
    var {network, verificationErrorField, configurationTemplateExists} = this.props;
    var meta = network.get('meta');
    if (!meta.configurable) return null;

    var networkName = network.get('name');

    var ipRangeProps = this.composeProps('ip_ranges', true);
    var gatewayProps = this.composeProps('gateway');

    return (
      <div className={'forms-box ' + networkName}>
        <h3 className='networks'>
          {i18n('network.' + networkName)}
          <NetworkRequirementsHelp sectionName={networkName} />
        </h3>
        <div className='network-description'>{i18n('network.descriptions.' + networkName)}</div>
        <CidrControl
          {... this.composeProps('cidr')}
          changeNetworkNotation={this.changeNetworkNotation}
          autoUpdateParameters={this.autoUpdateParameters}
        />
        <Range
          {...ipRangeProps}
          disabled={ipRangeProps.disabled || meta.notation === 'cidr'}
          rowsClassName='ip-ranges-rows'
          verificationError={_.includes(verificationErrorField, 'ip_ranges')}
        />
        {meta.use_gateway &&
          <Input
            {...gatewayProps}
            type='text'
            disabled={gatewayProps.disabled || meta.notation === 'cidr'}
          />
        }
        <VlanTagInput
          {... this.composeProps('vlan_start')}
          label={i18n(networkTabNS + 'network.use_vlan_tagging')}
          value={network.get('vlan_start')}
          configurationTemplateExists={configurationTemplateExists}
        />
      </div>
    );
  }
});

var NetworkingL2Parameters = React.createClass({
  mixins: [
    NetworkInputsMixin,
    NetworkModelManipulationMixin
  ],
  statics: {
    renderedParameters: [
      'vlan_range', 'gre_id_range', 'base_mac'
    ]
  },
  render() {
    var networkParameters =
      this.props.cluster.get('networkConfiguration').get('networking_parameters');
    var idRangePrefix = networkParameters.get('segmentation_type') === 'vlan' ? 'vlan' : 'gre_id';
    return (
      <div className='forms-box form-neutron-l2' key='neutron-l2'>
        <h3 className='networks'>
          {i18n(parametersNS + 'l2_configuration')}
          <NetworkRequirementsHelp
            sectionName={'l2_configuration_' + networkParameters.get('segmentation_type')}
          />
        </h3>
        <div className='network-description'>
          {
            i18n(networkTabNS + 'networking_parameters.l2_' +
            networkParameters.get('segmentation_type') + '_description')
          }
        </div>
        <div>
          <Range
            {...this.composeProps(idRangePrefix + '_range', true)}
            extendable={false}
            placeholder=''
            integerValue
            mini
          />
          {this.renderInput('base_mac')}
        </div>
      </div>
    );
  }
});

var NetworkingL3Parameters = React.createClass({
  mixins: [
    NetworkInputsMixin,
    NetworkModelManipulationMixin
  ],
  statics: {
    renderedParameters: [
      'floating_ranges', 'internal_cidr', 'internal_gateway',
      'internal_name', 'floating_name', 'baremetal_range',
      'baremetal_gateway', 'dns_nameservers'
    ]
  },
  render() {
    var networks = this.props.cluster.get('networkConfiguration').get('networks');
    return (
      <div key='neutron-l3'>
        <div className='forms-box form-floating-network' key='floating-net'>
          <h3>
            <span className='subtab-group-floating-net'>{i18n(networkTabNS + 'floating_net')}</span>
            <NetworkRequirementsHelp sectionName='floating' />
          </h3>
          <div className='network-description'>{i18n('network.descriptions.floating')}</div>
          <Range
            {...this.composeProps('floating_ranges', true)}
            rowsClassName='floating-ranges-rows'
            hiddenControls
          />
          {this.renderInput('floating_name', false, {maxLength: '65'})}
        </div>
        <div className='forms-box form-internal-network' key='internal-net'>
          <h3>
            <span className='subtab-group-internal-net'>{i18n(networkTabNS + 'internal_net')}</span>
            <NetworkRequirementsHelp sectionName='internal' />
          </h3>
          <div className='network-description'>{i18n('network.descriptions.internal')}</div>
          {this.renderInput('internal_cidr')}
          {this.renderInput('internal_gateway')}
          {this.renderInput('internal_name', false, {maxLength: '65'})}
        </div>
        {networks.find({name: 'baremetal'}) &&
          <div className='forms-box form-baremetal-network' key='baremetal-net'>
            <h3>
              <span className='subtab-group-baremetal-net'>
                {i18n(networkTabNS + 'baremetal_net')}
                <NetworkRequirementsHelp sectionName='baremetal' />
              </span>
            </h3>
            <div className='network-description'>
              {i18n(networkTabNS + 'networking_parameters.baremetal_parameters_description')}
            </div>
            <Range
              key='baremetal_range'
              {...this.composeProps('baremetal_range', true)}
              extendable={false}
              hiddenControls
            />
            {this.renderInput('baremetal_gateway')}
          </div>
        }
        <div className='forms-box form-dns-nameservers' key='dns-nameservers'>
          <h3>
            <span className='subtab-group-dns-nameservers'>
              {i18n(networkTabNS + 'dns_nameservers')}
              <NetworkRequirementsHelp sectionName='dns_nameservers' />
            </span>
          </h3>
          <div className='network-description'>
            {i18n(networkTabNS + 'networking_parameters.dns_servers_description')}
          </div>
          <customControls.text_list max={5} {...this.composeProps('dns_nameservers', true)} />
        </div>
      </div>
    );
  }
});

var NetworkSubtabs = React.createClass({
  renderClickablePills(subtabs) {
    return subtabs.map((subtab) => {
      var urlParts = subtab.url.split('/');
      var subTabClassName = urlParts[0] === 'group' && urlParts[1] || urlParts[0];
      return (
        <li
          key={subtab.label}
          role='presentation'
          className={utils.classNames({
            active: String(subtab.url) === this.props.activeGroupName,
            warning: this.props.isMultiRack && subtab.url === 'network_verification',
            [subTabClassName]: true
          })}
        >
          <Link
            className={'subtab-link-' + subTabClassName}
            to={'/cluster/' + this.props.cluster.id + '/network/' + subtab.url}
            onClick={app.allowLeaving}
          >
            {subtab.isInvalid && <i className='subtab-icon glyphicon-danger-sign' />}
            {subtab.label}
          </Link>
        </li>
      );
    });
  },
  getNetworkSettingsError(subtab) {
    var errors = (this.props.validationError || {}).networking_parameters;
    if (subtab === 'neutron_l2') {
      return !!_.intersection(NetworkingL2Parameters.renderedParameters, _.keys(errors)).length;
    }
    if (subtab === 'neutron_l3') {
      return !!_.intersection(NetworkingL3Parameters.renderedParameters, _.keys(errors)).length;
    }
    if (subtab === 'network_settings') {
      var settings = this.props.cluster.get('settings');
      return _.some(_.keys(settings.validationError), (settingPath) => {
        var settingSection = settingPath.split('.')[0];
        return settings.get(settingSection).metadata.group === 'network' ||
          settings.get(settingPath).group === 'network';
      });
    }
    return false;
  },
  getError(subtab) {
    var {cluster, validationError, showVerificationResult} = this.props;
    subtab = subtab.split('/');
    if (subtab[0] === 'group') {
      var networksValidationError = (validationError || {}).networks;
      return subtab[1] === 'all' ?
        !!networksValidationError
      :
        !!(networksValidationError || {})[subtab[1]];
    }
    if (subtab[0] === 'network_verification') {
      return showVerificationResult && !!cluster.task({name: 'verify_networks', status: 'error'});
    }
    return this.getNetworkSettingsError(subtab[0]);
  },
  render() {
    var {showAllNetworks} = this.props;
    var nodeNetworkGroups = this.props.cluster.get('nodeNetworkGroups');
    var groupedSubtabs = _.groupBy(this.props.subtabs, (subtab) => {
      subtab = subtab.split('/');
      if (showAllNetworks && subtab[0] === 'group') return 'networks';
      if (subtab[0] === 'group') return 'node_network_groups';
      if (subtab[0] === 'network_verification') return subtab[0];
      return 'settings';
    });
    return (
      <div className='col-xs-2'>
        <CSSTransitionGroup
          component='div'
          transitionName='subtab-item'
          transitionEnter={false}
          transitionLeave={false}
          key='network-subtabs'
          id='network-subtabs'
        >
          {_.map([
            showAllNetworks ? 'networks' : 'node_network_groups',
            'settings',
            'network_verification'
          ], (groupName) => {
            return (
              <ul className={'nav nav-pills nav-stacked ' + groupName} key={groupName}>
                <li className={'group-title ' + groupName}>
                  {i18n(networkTabNS + 'subtabs.groups.' + groupName)}
                </li>
                {this.renderClickablePills(groupedSubtabs[groupName].map((url) => {
                  var label = i18n(networkTabNS + 'subtabs.' + url);
                  if (groupName === 'node_network_groups') {
                    label = nodeNetworkGroups.get(url.split('/')[1]).get('name');
                  }
                  if (groupName === 'networks') {
                    label = i18n(networkTabNS + 'subtabs.all_networks');
                  }
                  return {
                    url: url,
                    label: label,
                    isInvalid: this.getError(url)
                  };
                }))}
              </ul>
            );
          })}
        </CSSTransitionGroup>
      </div>
    );
  }
});

var NetworkSettings = React.createClass({
  onChange(groupName, settingName, value) {
    var settings = this.props.cluster.get('settings');
    var name = utils.makePath(groupName, settingName, settings.getValueAttribute(settingName));
    this.props.settingsForChecks.set(name, value);
    settings.validationError = null;
    settings.set(name, value);
    settings.isValid({models: this.props.configModels});
  },
  checkRestrictions(action, setting) {
    return this.props.cluster.get('settings')
      .checkRestrictions(this.props.configModels, action, setting);
  },
  render() {
    var {cluster, locked} = this.props;
    var settings = cluster.get('settings');
    var allocatedRoles = cluster.getAllocatedRoles();

    return (
      <div className='forms-box network'>
        {
          _.chain(settings.attributes)
            .keys()
            .filter(
              (sectionName) => {
                var section = settings.get(sectionName);
                return (section.metadata.group === 'network' ||
                  _.some(section, {group: 'network'})) &&
                  !this.checkRestrictions('hide', section.metadata).result;
              }
            )
            .sortBy(
              (sectionName) => settings.get(sectionName + '.metadata.weight')
            )
            .map(
              (sectionName) => {
                var section = settings.get(sectionName);
                var settingsToDisplay = _.compact(_.map(section, (setting, settingName) => {
                  if (
                    (section.metadata.group || setting.group === 'network') &&
                    settings.isSettingVisible(setting, settingName, this.props.configModels)
                  ) return settingName;
                }));
                if (_.isEmpty(settingsToDisplay) && !settings.isPlugin(section)) return null;
                return <SettingSection
                  {... _.pick(
                    this.props,
                    'cluster', 'initialAttributes', 'settingsForChecks', 'configModels'
                  )}
                  key={sectionName}
                  sectionName={sectionName}
                  settingsToDisplay={settingsToDisplay}
                  onChange={_.partial(this.onChange, sectionName)}
                  allocatedRoles={allocatedRoles}
                  settings={settings}
                  getValueAttribute={settings.getValueAttribute}
                  locked={locked}
                  checkRestrictions={this.checkRestrictions}
                />;
              }
            )
            .value()
        }
      </div>
    );
  }
});

var NetworkVerificationResult = React.createClass({
  getConnectionStatus(task, isFirstConnectionLine) {
    if (!task || task.match({status: 'ready'})) return 'stop';
    if (task && task.match({status: 'error'}) && !(isFirstConnectionLine &&
      !task.get('result').length)) return 'error';
    return 'success';
  },
  render() {
    var task = this.props.task;
    var ns = networkTabNS + 'verify_networks.';

    if (this.props.hideVerificationResult) task = null;
    return (
      <div className='verification-control'>
        <div className='forms-box'>
          <h3>{i18n(networkTabNS + 'subtabs.network_verification')}</h3>
          {this.props.isMultirack &&
            <div className='alert alert-warning'>
              <p>{i18n(networkTabNS + 'verification_multirack_warning')}</p>
            </div>
          }
          {!this.props.isMultirack && this.props.notEnoughNodes &&
            <div className='alert alert-warning'>
              <p>{i18n(networkTabNS + 'not_enough_nodes')}</p>
            </div>
          }
          <div className='page-control-box'>
            <div className='verification-box row'>
              <div className='verification-network-placeholder col-xs-10 col-xs-offset-2'>
                <div className='router-box'>
                  <div className='verification-router'></div>
                </div>
                <div className='animation-box'>
                  {_.times(3, (index) => {
                    ++index;
                    return <div
                      key={index}
                      className={this.getConnectionStatus(task, index === 1) + ' connect-' + index}
                    >
                    </div>;
                  })}
                </div>
                <div className='nodes-box'>
                  {_.times(3, (index) => {
                    ++index;
                    return <div key={index} className={'verification-node-' + index}></div>;
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className='row'>
            <div className='verification-text-placeholder col-xs-12'>
              <ol className='verification-description'>
                {_.times(5, (index) => {
                  return <li key={index}>{i18n(ns + 'step_' + index)}</li>;
                })}
              </ol>
            </div>
          </div>
          <ProgressButton
            key='verify_networks'
            className='btn btn-default verify-networks-btn'
            onClick={this.props.verifyNetworks}
            disabled={this.props.isVerificationDisabled}
            progress={this.props.isVerificationInProgress || this.props.actionInProgress === true}
          >
            {i18n(networkTabNS + 'verify_networks_button')}
          </ProgressButton>
        </div>
        {(task && task.match({status: 'ready'})) &&
          <div className='col-xs-12'>
            <div className='alert alert-success enable-selection'>
              {i18n(ns + 'success_alert')}
            </div>
            {task.get('message') &&
              <div className='alert alert-warning enable-selection'>
                {task.get('message')}
              </div>
            }
          </div>
        }
        {task && task.match({status: 'error'}) &&
          <div className='col-xs-12'>
            <div className='alert alert-danger enable-selection network-alert'>
              {i18n(ns + 'fail_alert')}
              {utils.renderMultilineText(task.get('message'))}
            </div>
          </div>
        }
        {(task && !!task.get('result').length) &&
          <div className='verification-result-table col-xs-12'>
            <Table
              tableClassName='table table-condensed enable-selection'
              noStripes
              head={_.map(['node_name', 'node_mac_address', 'node_interface', 'expected_vlan'],
                (attr) => ({label: i18n(ns + attr)}))}
              body={
                _.map(task.get('result'), (node) => {
                  var absentVlans = _.map(node.absent_vlans, (vlan) => {
                    return vlan || i18n(networkTabNS + 'untagged');
                  });
                  return [
                    node.name || 'N/A',
                    node.mac || 'N/A',
                    node.interface,
                    absentVlans.join(', ')
                  ];
                })
              }
            />
          </div>
        }
      </div>
    );
  }
});

export default NetworkTab;
