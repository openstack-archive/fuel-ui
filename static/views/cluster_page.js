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
import _ from 'underscore';
import i18n from 'i18n';
import React from 'react';
import {Link} from 'react-router';
import utils from 'utils';
import models from 'models';
import dispatcher from 'dispatcher';
import {backboneMixin, pollingMixin, dispatcherMixin, loadPropsMixin} from 'component_mixins';
import DashboardTab from 'views/cluster_page_tabs/dashboard_tab';
import NodesTab from 'views/cluster_page_tabs/nodes_tab';
import NetworkTab from 'views/cluster_page_tabs/network_tab';
import SettingsTab from 'views/cluster_page_tabs/settings_tab';
import LogsTab from 'views/cluster_page_tabs/logs_tab';
import HealthCheckTab from 'views/cluster_page_tabs/healthcheck_tab';
import {VmWareTab, VmWareModels} from 'plugins/vmware/vmware';

var ClusterPage = React.createClass({
  mixins: [
    pollingMixin(5),
    backboneMixin('cluster', 'change:name change:is_customized change:release'),
    backboneMixin({
      modelOrCollection: (props) => props.cluster.get('nodes')
    }),
    backboneMixin({
      modelOrCollection: (props) => props.cluster.get('tasks'),
      renderOn: 'update change'
    }),
    dispatcherMixin('networkConfigurationUpdated', 'removeFinishedNetworkTasks'),
    dispatcherMixin('deploymentTasksUpdated', 'removeFinishedDeploymentTasks'),
    dispatcherMixin('deploymentTaskStarted', function() {
      this.refreshCluster().then(this.startPolling, this.startPolling);
    }),
    dispatcherMixin('networkVerificationTaskStarted', function() {
      this.startPolling();
    }),
    dispatcherMixin('deploymentTaskFinished', function() {
      this.refreshCluster().then(
        () => dispatcher.trigger('updateNotifications'),
        () => dispatcher.trigger('updateNotifications')
      );
    }),
    loadPropsMixin
  ],
  statics: {
    breadcrumbsPath(pageOptions) {
      var clusterId = pageOptions.params.id;
      var clusterTitle = app.breadcrumbs.clusterName;
      var activeTab = pageOptions.location.pathname.replace(/^.*cluster\/\d+\/([^\/?]+).*$/g, '$1');
      var breadcrumbs = [
        ['home', '/'],
        ['environments', '/clusters'],
        [clusterTitle, '/cluster/' + clusterId, {skipTranslation: true}]
      ];
      return breadcrumbs.concat(
          _.find(this.getTabs(), {url: activeTab}).tab.breadcrumbsPath(pageOptions)
        );
    },
    title() {
      var clusterTitle = app.breadcrumbs.clusterName;
      return clusterTitle;
    },
    getTabs() {
      return [
        {url: 'dashboard', tab: DashboardTab},
        {url: 'nodes', tab: NodesTab},
        {url: 'network', tab: NetworkTab},
        {url: 'settings', tab: SettingsTab},
        {url: 'vmware', tab: VmWareTab},
        {url: 'logs', tab: LogsTab},
        {url: 'healthcheck', tab: HealthCheckTab}
      ];
    },
    fetchData(params) {
      var cluserId = Number(params.params.id);
      var cluster = new models.Cluster({id: cluserId});
      var baseUrl = _.result(cluster, 'url');

      var settings = new models.Settings();
      settings.url = baseUrl + '/attributes';
      cluster.set({settings});

      var roles = new models.Roles();
      roles.url = baseUrl + '/roles';
      cluster.set({roles});

      var pluginLinks = new models.PluginLinks();
      pluginLinks.url = baseUrl + '/plugin_links';
      cluster.set({pluginLinks});

      cluster.get('nodeNetworkGroups').fetch = utils.fetchClusterProperties(cluserId);
      cluster.get('nodes').fetch = utils.fetchClusterProperties(cluserId);

      return Promise.all([
        cluster.fetch(),
        cluster.get('settings').fetch(),
        cluster.get('roles').fetch(),
        cluster.get('pluginLinks').fetch({cache: true}),
        cluster.fetchRelated('nodes'),
        cluster.fetchRelated('tasks'),
        cluster.fetchRelated('nodeNetworkGroups')
      ])
      .then(() => {
        app.breadcrumbs.clusterName = cluster.get('name');
        dispatcher.trigger('updatePageLayout');

        app.cluster = cluster;

        var networkConfiguration = new models.NetworkConfiguration();
        networkConfiguration.url = baseUrl + '/network_configuration/' +
          cluster.get('net_provider');

        cluster.set({
          networkConfiguration,
          release: new models.Release({id: cluster.get('release_id')})
        });

        var fetched = [
          cluster.get('networkConfiguration').fetch(),
          cluster.get('release').fetch()
        ];

        if (cluster.get('settings').get('common.use_vcenter.value')) {
          cluster.set({vcenter: new VmWareModels.VCenter({id: cluserId})});
          fetched.push(cluster.get('vcenter').fetch());
        }

        var deployedSettings = new models.Settings();
        deployedSettings.url = baseUrl + '/attributes/deployed';

        var deployedNetworkConfiguration = new models.NetworkConfiguration();
        deployedNetworkConfiguration.url = baseUrl + '/network_configuration/deployed';

        cluster.set({deployedSettings, deployedNetworkConfiguration});

        if (cluster.get('status') !== 'new') {
          fetched.push(
            cluster.get('deployedSettings').fetch().catch(() => true),
            cluster.get('deployedNetworkConfiguration').fetch().catch(() => true)
          );
        }

        return Promise.all(fetched)
          .then(() => {
            return {cluster, tabOptions: params.params};
          });
      });
    }
  },
  getDefaultProps() {
    return {
      defaultLogLevel: 'INFO'
    };
  },
  getInitialState() {
    var selectedNodes = utils.deserializeTabOptions(this.props.params.options).nodes;
    var activeTab = this.props.location.pathname.replace(/^.*cluster\/\d+\/([^\/]+).*$/g, '$1');
    var states = {
      selectedNodeIds: selectedNodes ?
        _.reduce(selectedNodes.split(','), (result, id) => {
          result[Number(id)] = true;
          return result;
        }, {})
      :
        {},
      showAllNetworks: false
    };
    _.each(this.constructor.getTabs(), (tabData) => {
      if (tabData.tab.checkSubroute) {
        _.extend(
          states,
          tabData.tab.checkSubroute(_.extend({}, this.props, {activeTab}))
        );
      }
    });
    return states;
  },
  removeFinishedNetworkTasks(callback) {
    var request = this.removeFinishedTasks(this.props.cluster.tasks({group: 'network'}));
    if (callback) request.then(callback, callback);
    return request;
  },
  removeFinishedDeploymentTasks() {
    return this.removeFinishedTasks(this.props.cluster.tasks({group: 'deployment'}));
  },
  removeFinishedTasks(tasks) {
    var requests = [];
    _.each(tasks, (task) => {
      if (task.match({active: false})) {
        this.props.cluster.get('tasks').remove(task);
        requests.push(task.destroy({silent: true}));
      }
    });
    return Promise.all(requests);
  },
  shouldDataBeFetched() {
    return this.props.cluster.task({group: ['deployment', 'network'], active: true});
  },
  fetchData() {
    var task = this.props.cluster.task({group: 'deployment', active: true});
    if (task) {
      return task.fetch()
        .then(() => {
          if (task.match({active: false})) dispatcher.trigger('deploymentTaskFinished');
          return this.props.cluster.fetchRelated('nodes');
        });
    } else {
      task = this.props.cluster.task({name: 'verify_networks', active: true});
      return task ? task.fetch() : Promise.resolve();
    }
  },
  refreshCluster() {
    var {cluster} = this.props;
    return Promise.all([
      cluster.fetch(),
      cluster.fetchRelated('nodes'),
      cluster.fetchRelated('tasks'),
      cluster.get('networkConfiguration').fetch(),
      cluster.get('pluginLinks').fetch()
    ])
    .then(() => {
      if (cluster.get('status') === 'new') return Promise.resolve();
      return Promise.all([
        cluster.get('deployedNetworkConfiguration').fetch().catch(() => true),
        cluster.get('deployedSettings').fetch().catch(() => true)
      ]);
    });
  },
  componentWillMount() {
    this.props.cluster.on('change:release_id', () => {
      var release = new models.Release({id: this.props.cluster.get('release_id')});
      release.fetch().then(() => {
        this.props.cluster.set({release});
      });
    });
  },
  componentWillReceiveProps(newProps) {
    var activeTab = newProps.location.pathname.replace(/^.*cluster\/\d+\/([^\/]+).*$/g, '$1');
    var tab = _.find(this.constructor.getTabs(), {url: activeTab}).tab;
    if (tab.checkSubroute) {
      this.setState(tab.checkSubroute(_.extend(
        {},
        newProps,
        {showAllNetworks: this.state.showAllNetworks},
        {activeTab}
      )));
    }
  },
  changeLogSelection(selectedLogs) {
    this.setState({selectedLogs});
  },
  getAvailableTabs(cluster) {
    return _.filter(this.constructor.getTabs(),
      (tabData) => !tabData.tab.isVisible || tabData.tab.isVisible(cluster));
  },
  selectNodes(selectedNodeIds) {
    this.setState({selectedNodeIds});
  },
  render() {
    var {cluster, children, tabData} = this.props;
    var activeTab = this.props.location.pathname.replace(/^.*cluster\/\d+\/([^\/]+).*$/g, '$1');
    var availableTabs = this.getAvailableTabs(cluster);
    var tabUrls = _.map(availableTabs, 'url');
    var subroutes = {
      settings: this.state.activeSettingsSectionName,
      network: this.state.activeNetworkSectionName,
      logs: utils.serializeTabOptions(this.state.selectedLogs)
    };
    var tab = _.find(availableTabs, {url: activeTab});
    if (!tab) return null;
    var props = _.assign(
        _.pick(this, 'selectNodes', 'changeLogSelection'),
        _.pick(this.props, 'cluster', 'tabOptions'),
        this.state,
        tabData,
        {activeTab}
      );
    var Tab = children &&
      React.cloneElement(children, props);

    return (
      <div className='cluster-page' key={cluster.id}>
        <div className='page-title'>
          <h1 className='title'>
            {cluster.get('name')}
            <div
              className='title-node-count'
            >
              ({i18n('common.node', {count: cluster.get('nodes').length})})
            </div>
          </h1>
        </div>
        <div className='tabs-box'>
          <div className='tabs'>
            {tabUrls.map((tabUrl) => {
              var url = '/cluster/' + cluster.id + '/' + tabUrl +
                (subroutes[tabUrl] ? '/' + subroutes[tabUrl] : '');
              return (
                <Link
                  key={tabUrl}
                  className={
                    tabUrl + ' ' + utils.classNames({
                      'cluster-tab': true,
                      active: activeTab === tabUrl
                    })
                  }
                  to={url}
                >
                  <div className='icon' />
                  <div className='label'>{i18n('cluster_page.tabs.' + tabUrl)}</div>
                </Link>
              );
            })}
          </div>
        </div>
        <div key={tab.url + cluster.id} className={'content-box tab-content ' + tab.url + '-tab'}>
          {Tab}
        </div>
      </div>
    );
  }
});

export default ClusterPage;
