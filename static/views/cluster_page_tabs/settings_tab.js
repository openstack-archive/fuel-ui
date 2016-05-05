/*
 * Copyright 2015 Mirantis, Inc.
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
import React from 'react';
import utils from 'utils';
import models from 'models';
import {backboneMixin, unsavedChangesMixin} from 'component_mixins';
import SettingSection from 'views/cluster_page_tabs/setting_section';
import CSSTransitionGroup from 'react-addons-transition-group';

var SettingsTab = React.createClass({
  mixins: [
    backboneMixin('cluster', 'change:status'),
    backboneMixin({
      modelOrCollection(props) {
        return props.cluster.get('settings');
      },
      renderOn: 'change invalid'
    }),
    backboneMixin({modelOrCollection(props) {
      return props.cluster.get('tasks');
    }}),
    backboneMixin({modelOrCollection(props) {
      return props.cluster.task({group: 'deployment', active: true});
    }}),
    unsavedChangesMixin
  ],
  statics: {
    breadcrumbsPath() {
      return [
        [i18n('cluster_page.tabs.settings'), null, {active: true}]
      ];
    },
    fetchData({cluster}) {
      return $.when(
        cluster.get('settings').fetch({cache: true}),
        cluster.get('networkConfiguration').fetch({cache: true})
      ).then(() => ({}));
    },
    getSubtabs(options) {
      return options.cluster.get('settings').getGroupList();
    },
    checkSubroute(tabProps) {
      var {activeTab, cluster, tabOptions} = tabProps;
      var subtabs = this.getSubtabs(tabProps);
      if (activeTab === 'settings') {
        var subroute = tabOptions[0];
        if (!subroute || !_.includes(subtabs, subroute)) {
          app.navigate(
            'cluster/' + cluster.id + '/settings/' + subtabs[0],
            {trigger: true, replace: true}
          );
        }
        return {activeSettingsSectionName: subroute};
      }
      return {activeSettingsSectionName: subtabs[0]};
    }
  },
  getInitialState() {
    var settings = this.props.cluster.get('settings');
    return {
      configModels: {
        cluster: this.props.cluster,
        settings: settings,
        networking_parameters: this.props.cluster.get('networkConfiguration')
          .get('networking_parameters'),
        version: app.version,
        release: this.props.cluster.get('release'),
        default: settings
      },
      settingsForChecks: new models.Settings(_.cloneDeep(settings.attributes)),
      initialAttributes: _.cloneDeep(settings.attributes),
      actionInProgress: false
    };
  },
  componentDidMount() {
    this.props.cluster.get('settings').isValid({models: this.state.configModels});
  },
  componentWillUnmount() {
    this.loadInitialSettings();
  },
  hasChanges() {
    return this.props.cluster.get('settings').hasChanges(
      this.state.initialAttributes,
      this.state.configModels
    );
  },
  applyChanges() {
    if (!this.isSavingPossible()) return $.Deferred().reject();

    var settings = this.props.cluster.get('settings');
    var deferred = settings.save(null, {patch: true, wait: true, validate: false});
    if (deferred) {
      this.setState({actionInProgress: true});
      deferred
        .done(() => {
          this.setState({initialAttributes: _.cloneDeep(settings.attributes)});
          // some networks may have restrictions which are processed by nailgun,
          // so networks need to be refetched after updating cluster attributes
          this.props.cluster.get('networkConfiguration').cancelThrottling();
        })
        .always(() => {
          this.setState({
            actionInProgress: false,
            key: _.now()
          });
          this.props.cluster.fetch();
        })
        .fail((response) => {
          utils.showErrorDialog({
            title: i18n('cluster_page.settings_tab.settings_error.title'),
            message: i18n('cluster_page.settings_tab.settings_error.saving_warning'),
            response: response
          });
        });
    }
    return deferred;
  },
  loadDefaults() {
    this.setState({actionInProgress: true});
    var defaultSettings = new models.Settings();
    defaultSettings
    .fetch({
      url: _.result(this.props.cluster, 'url') + '/attributes/defaults'
    })
    .done(() => {
      this.props.cluster.get('settings').updateSettings(
        defaultSettings,
        this.state.configModels,
        false
      );
      this.setState({
        actionInProgress: false,
        key: _.now()
      });
    })
    .fail((response) => {
      this.setState({actionInProgress: false});
      var ns = 'cluster_page.settings_tab.settings_error';
      utils.showErrorDialog({
        title: i18n(ns + 'title'),
        message: i18n(ns + 'load_settings_warning'),
        response
      });
    });
  },
  loadDeployedSettings() {
    this.props.cluster.get('settings').updateSettings(
      this.props.cluster.get('deployedSettings'),
      this.state.configModels,
      false
    );
    this.setState({key: _.now()});
  },
  revertChanges() {
    this.loadInitialSettings();
    this.setState({key: _.now()});
  },
  loadInitialSettings() {
    var settings = this.props.cluster.get('settings');
    settings.set(_.cloneDeep(this.state.initialAttributes), {silent: true, validate: false});
    settings.mergePluginSettings();
    settings.isValid({models: this.state.configModels});
  },
  onChange(groupName, settingName, value) {
    var settings = this.props.cluster.get('settings');
    var name = utils.makePath(groupName, settingName, settings.getValueAttribute(settingName));
    this.state.settingsForChecks.set(name, value);
    // FIXME: the following hacks cause we can't pass {validate: true} option to set method
    // this form of validation isn't supported in Backbone DeepModel
    settings.validationError = null;
    settings.set(name, value);
    settings.isValid({models: this.state.configModels});
  },
  checkRestrictions(action, setting) {
    return this.props.cluster.get('settings').checkRestrictions(
      this.state.configModels,
      action,
      setting
    );
  },
  isSavingPossible() {
    var settings = this.props.cluster.get('settings');
    // network settings are shown on Networks tab, so they should not block
    // saving of changes on Settings tab
    var areSettingsValid = !_.some(_.keys(settings.validationError), (settingPath) => {
      var settingSection = settingPath.split('.')[0];
      return settings.get(settingSection).metadata.group !== 'network' &&
        settings.get(settingPath).group !== 'network';
    });
    return !this.isLocked() && this.hasChanges() && areSettingsValid;
  },
  isLocked() {
    return this.state.actionInProgress || !this.props.cluster.isAvailableForSettingsChanges();
  },
  render() {
    var cluster = this.props.cluster;
    var settings = cluster.get('settings');
    var settingsGroupList = this.constructor.getSubtabs({cluster});
    var locked = this.isLocked();
    var hasChanges = this.hasChanges();
    var allocatedRoles = _.uniq(_.flatten(_.union(
      cluster.get('nodes').map('roles'),
      cluster.get('nodes').map('pending_roles')
    )));
    var classes = {
      row: true,
      'changes-locked': locked
    };

    var invalidSections = {};
    _.each(settings.validationError, (error, key) => {
      invalidSections[_.first(key.split('.'))] = true;
    });

    // Prepare list of settings organized by groups
    var groupedSettings = {};
    _.each(settingsGroupList, (group) => groupedSettings[group] = {});
    _.each(settings.attributes, (section, sectionName) => {
      var isHidden = this.checkRestrictions('hide', section.metadata).result;
      if (!isHidden) {
        var group = section.metadata.group;
        var hasErrors = invalidSections[sectionName];
        if (group) {
          if (group !== 'network') {
            groupedSettings[settings.sanitizeGroup(group)][sectionName] = {invalid: hasErrors};
          }
        } else {
          // Settings like 'Common' can be splitted to different groups
          var settingGroups = _.chain(section)
            .omit('metadata')
            .map('group')
            .uniq()
            .without('network')
            .value();

          // to support plugins without settings (just for user to be able to switch its version)
          if (!settingGroups.length && settings.isPlugin(section)) {
            groupedSettings.other[sectionName] = {settings: [], invalid: hasErrors};
          }

          _.each(settingGroups, (settingGroup) => {
            var calculatedGroup = settings.sanitizeGroup(settingGroup);
            var pickedSettings = _.compact(_.map(section, (setting, settingName) => {
              if (
                settingName !== 'metadata' &&
                settings.sanitizeGroup(setting.group) === calculatedGroup &&
                !this.checkRestrictions('hide', setting).result
              ) return settingName;
            }));
            var hasErrors = _.some(pickedSettings, (settingName) => {
              return (settings.validationError || {})[utils.makePath(sectionName, settingName)];
            });
            if (!_.isEmpty(pickedSettings)) {
              groupedSettings[calculatedGroup][sectionName] = {
                settings: pickedSettings,
                invalid: hasErrors
              };
            }
          });
        }
      }
    });
    groupedSettings = _.omitBy(groupedSettings, _.isEmpty);

    return (
      <div key={this.state.key} className={utils.classNames(classes)}>
        <div className='title'>{i18n('cluster_page.settings_tab.title')}</div>
        <SettingSubtabs
          cluster={cluster}
          settings={settings}
          settingsGroupList={settingsGroupList}
          groupedSettings={groupedSettings}
          configModels={this.state.configModels}
          setActiveSettingsGroupName={this.props.setActiveSettingsGroupName}
          activeSettingsSectionName={this.props.activeSettingsSectionName}
          checkRestrictions={this.checkRestrictions}
        />
        {_.map(groupedSettings, (selectedGroup, groupName) => {
          if (groupName !== this.props.activeSettingsSectionName) return null;

          var sortedSections = _.sortBy(
            _.keys(selectedGroup), (name) => settings.get(name + '.metadata.weight')
          );
          return (
            <div className={'col-xs-10 forms-box ' + groupName} key={groupName}>
              {_.map(sortedSections, (sectionName) => {
                var settingsToDisplay = selectedGroup[sectionName].settings ||
                  _.compact(_.map(settings.get(sectionName), (setting, settingName) => {
                    if (
                      settingName !== 'metadata' &&
                      !this.checkRestrictions('hide', setting).result
                    ) return settingName;
                  }));
                return <SettingSection
                  {... _.pick(this.state, 'initialAttributes', 'settingsForChecks', 'configModels')}
                  key={sectionName}
                  cluster={this.props.cluster}
                  sectionName={sectionName}
                  settingsToDisplay={settingsToDisplay}
                  onChange={_.partial(this.onChange, sectionName)}
                  allocatedRoles={allocatedRoles}
                  settings={settings}
                  getValueAttribute={settings.getValueAttribute}
                  locked={locked}
                  checkRestrictions={this.checkRestrictions}
                />;
              })}
            </div>
          );
        })}
        <div className='col-xs-12 page-buttons content-elements'>
          <div className='well clearfix'>
            <div className='btn-group pull-right'>
              <button
                className='btn btn-default btn-revert-changes'
                onClick={this.revertChanges}
                disabled={locked || !hasChanges}
              >
                {i18n('common.cancel_changes_button')}
              </button>
              <button
                className='btn btn-success btn-apply-changes'
                onClick={this.applyChanges}
                disabled={!this.isSavingPossible()}
              >
                {i18n('common.save_settings_button')}
              </button>
            </div>
            <div className='btn-group pull-right'>
              <button
                className='btn btn-default btn-load-defaults'
                onClick={this.loadDefaults}
                disabled={locked}
              >
                {i18n('common.load_defaults_button')}
              </button>
              {cluster.get('status') !== 'new' &&
                !_.isEmpty(cluster.get('deployedSettings').attributes) &&
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
        </div>
      </div>
    );
  }
});

var SettingSubtabs = React.createClass({
  render() {
    return (
      <div className='col-xs-2'>
        <CSSTransitionGroup
          component='ul'
          transitionName='subtab-item'
          className='nav nav-pills nav-stacked'
        >
        {
          this.props.settingsGroupList.map((groupName) => {
            if (!this.props.groupedSettings[groupName]) return null;

            var hasErrors = _.some(_.map(this.props.groupedSettings[groupName], 'invalid'));
            return (
              <li
                key={groupName}
                role='presentation'
                className={utils.classNames({
                  active: groupName === this.props.activeSettingsSectionName
                })}
              >
                <a
                  className={'no-leave-check subtab-link-' + groupName}
                  href={'#cluster/' + this.props.cluster.id + '/settings/' + groupName}
                >
                  {hasErrors && <i className='subtab-icon glyphicon-danger-sign'/>}
                  {i18n('cluster_page.settings_tab.groups.' + groupName, {defaultValue: groupName})}
                </a>
              </li>
            );
          })
        }
        </CSSTransitionGroup>
      </div>
    );
  }
});

export default SettingsTab;
