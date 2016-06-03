/*
 * Copyright 2013 Mirantis, Inc.
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
import {Router, Route, IndexRoute, Redirect,
  IndexRedirect, hashHistory, withRouter} from 'react-router';
import AsyncProps from 'async-props';
import models from 'models';
import {NailgunUnavailabilityDialog} from 'views/dialogs';
import KeystoneClient from 'keystone_client';
import RootComponent from 'views/root';
import LoginPage from 'views/login_page.js';
import WelcomePage from 'views/welcome_page';

import ClusterPage from 'views/cluster_page';
import DashboardTab from 'views/cluster_page_tabs/dashboard_tab';
import NodesTab from 'views/cluster_page_tabs/nodes_tab';
import NetworkTab from 'views/cluster_page_tabs/network_tab';
import SettingsTab from 'views/cluster_page_tabs/settings_tab';
import LogsTab from 'views/cluster_page_tabs/logs_tab';
import HealthCheckTab from 'views/cluster_page_tabs/healthcheck_tab';
import {VmWareTab} from 'plugins/vmware/vmware';

import ClusterNodesScreen from 'views/cluster_page_tabs/nodes_tab_screens/cluster_nodes_screen';
import AddNodesScreen from 'views/cluster_page_tabs/nodes_tab_screens/add_nodes_screen';
import EditNodesScreen from 'views/cluster_page_tabs/nodes_tab_screens/edit_nodes_screen';
import EditNodeDisksScreen from 'views/cluster_page_tabs/nodes_tab_screens/edit_node_disks_screen';
import EditNodeInterfacesScreen from
  'views/cluster_page_tabs/nodes_tab_screens/edit_node_interfaces_screen';

import ClustersPage from 'views/clusters_page';
import EquipmentPage from 'views/equipment_page';
import ReleasesPage from 'views/releases_page';
import PluginsPage from 'views/plugins_page';
import NotificationsPage from 'views/notifications_page';
import SupportPage from 'views/support_page';
import CapacityPage from 'views/capacity_page';
import 'bootstrap';
import './styles/main.less';

class App {
  constructor() {
    this.initialized = false;

    // this is needed for IE,
    // which caches requests resulting in wrong results (e.g /ostf/testruns/last/1)
    $.ajaxSetup({cache: false});

    this.overrideBackboneSyncMethod();
    this.overrideBackboneAjax();

    this.version = new models.FuelVersion();
    this.fuelSettings = new models.FuelSettings();
    this.user = new models.User();
    this.statistics = new models.NodesStatistics();
    this.notifications = new models.Notifications();
    this.releases = new models.Releases();
    this.keystoneClient = new KeystoneClient('/keystone', {
      cacheTokenFor: 10 * 60 * 1000,
      tenant: 'admin',
      token: this.user.get('token')
    });
    this.breadcrumbs = {clusterName: ''};
    this.cluster = null;
    this.onLeave = null;
    this.leaveCheck = true;
    this.longFetch = false;
  }

  initialize() {
    this.initialized = true;
    this.mountNode = $('#main-container');

    document.title = i18n('common.title');

    return this.version.fetch()
      .catch((response) => {
        if (response.status === 401) {
          this.version.set({auth_required: true});
        }
      })
      .then(() => {
        this.user.set({authenticated: !this.version.get('auth_required')});
        if (this.version.get('auth_required')) {
          this.keystoneClient.token = this.user.get('token');
          return this.keystoneClient.authenticate()
            .then(() => {
              this.user.set({authenticated: true});
              return this.version.fetch({cache: true});
            });
        }
        return Promise.resolve();
      })
      .then(() => this.fuelSettings.fetch())
      .catch(() => {
        if (this.version.get('auth_required') && !this.user.get('authenticated')) {
          return Promise.resolve();
        } else {
          this.mountNode.empty();
          NailgunUnavailabilityDialog.show({}, {preventDuplicate: true});
          return Promise.reject();
        }
      })
      .then(() => this.renderLayout());
  }

  checkAuthentication(nextState, replace) {
    if (!this.user.get('authenticated') &&
      this.version.get('auth_required') &&
      nextState.location.pathname !== '/login') {
      // Redirect to login page and save return path
      replace({
        pathname: '/login',
        state: {nextPathname: nextState.location.pathname}
      });
    } else if (_.find(app.keystoneClient.userRoles, {name: 'admin'}) &&
      !app.fuelSettings.get('statistics.user_choice_saved.value') &&
      nextState.location.pathname !== '/welcome') {
      // Show user a welcome page
      replace({
        pathname: '/welcome',
        state: {nextPathname: nextState.location.pathname}
      });
    }
  }

  onRouteChange(prevState, nextState, replace, cb) {
    // Checks if there are conditions for transition abortion (unsaved data)
    app.longFetch = _.some(nextState.routes.map((route) => route.component.longFetch));

    if (app.onLeave &&
      prevState.location.pathname !== nextState.location.pathname &&
      app.leaveCheck) {
      Promise.all([
        _.result(app, 'onLeave')
      ])
        .then(
          () => {
            app.onLeave = null;
            app.leaveCheck = true;
            // Proceed with routing
            this.onEnter(nextState, replace);
          },
          () => {
            // Routing abortion, returning to the previous path
            replace({
              pathname: prevState.location.pathname
            });
          })
        .then(cb);
    } else {
      app.leaveCheck = true;
      // No leave checks registered or they are ignored, proceed with the transition
      this.onEnter(nextState, replace);
      return cb();
    }
  }

  allowLeaving() {
    app.leaveCheck = false;
  }

  renderLayout() {
    var defaults = _.pick(this, 'version', 'user', 'fuelSettings', 'statistics', 'notifications');
    this.routerComponent = ReactDOM.render(
      <Router
        history={hashHistory}
        render={(props) => <AsyncProps {...props} />}
      >
        <Route
          path='/'
          component={withRouter(RootComponent)}
          onEnter={this.checkAuthentication}
          onChange={this.onRouteChange}
          {...defaults}
        >
          <IndexRedirect to='clusters' />
          <Route path='login' component={LoginPage} />
          <Route path='welcome' component={WelcomePage} />
          <Route path='clusters' component={ClustersPage} />
          <Route path='cluster/:id' component={ClusterPage}>
            <IndexRedirect to='dashboard' />
            <Route path='dashboard' component={DashboardTab} />
            <Route path='nodes' component={NodesTab}>
              <IndexRoute component={ClusterNodesScreen} />
              <Route path='add' component={AddNodesScreen} />
              <Route path='edit/:options' component={EditNodesScreen} />
              <Route path='disks/:options' component={EditNodeDisksScreen} />
              <Route path='interfaces/:options' component={EditNodeInterfacesScreen} />
            </Route>
            <Route path='network(/:section(/:groupId))' component={NetworkTab} />
            <Route path='settings(/:section)' component={SettingsTab} />
            <Route path='logs(/:options)' component={LogsTab} />
            <Route path='healthcheck' component={HealthCheckTab} />
            <Route path='vmware' component={VmWareTab} />
            <Redirect from='*' to='dashboard' />
          </Route>
          <Route path='equipment' component={EquipmentPage} />
          <Route path='releases' component={ReleasesPage} />
          <Route path='plugins' component={PluginsPage} />
          <Route path='notifications' component={NotificationsPage} />
          <Route path='support' component={SupportPage} />
          <Route path='capacity' component={CapacityPage} />
        </Route>
        <Redirect from='*' to='/clusters' />
      </Router>,
      this.mountNode[0]);
  }

  navigate(path) {
    this.routerComponent.router.push(path);
  }

  navigatePreviousPath() {
    var path = _.result(this.routerComponent, 'state.location.state.nextPathname') || '/';
    this.navigate(path);
  }

  setPath(path) {
    this.routerComponent.router.replace(path);
  }

  logout() {
    if (this.user.get('authenticated') && this.version.get('auth_required')) {
      this.user.set('authenticated', false);
      this.user.unset('username');
      this.user.unset('token');

      this.keystoneClient.deauthenticate();
    }

    _.defer(() => this.navigate('/login', {trigger: true, replace: true}));
  }

  overrideBackboneSyncMethod() {
    var originalSyncMethod = Backbone.sync;
    if (originalSyncMethod.patched) return;
    Backbone.sync = function(method, model, options = {}) {
      // our server doesn't support PATCH, so use PUT instead
      if (method === 'patch') {
        method = 'update';
      }
      // add auth token to header if auth is enabled
      if (app.version && app.version.get('auth_required')) {
        return app.keystoneClient.authenticate()
          .catch(() => {
            app.logout();
            return Promise.reject();
          })
          .then(() => {
            app.user.set('token', app.keystoneClient.token);
            options.headers = options.headers || {};
            options.headers['X-Auth-Token'] = app.keystoneClient.token;
            return originalSyncMethod.call(this, method, model, options);
          })
          .catch((response) => {
            if (response && response.status === 401) {
              app.logout();
            }
            return Promise.reject(response);
          });
      }
      return originalSyncMethod.call(this, method, model, options);
    };
    Backbone.sync.patched = true;
  }

  overrideBackboneAjax() {
    Backbone.ajax = (...args) => Promise.resolve(Backbone.$.ajax(...args));
  }
}

window.app = new App();

$(() => app.initialize());

export default app;
