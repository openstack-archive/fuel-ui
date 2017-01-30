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
import models from 'models';
import dispatcher from 'dispatcher';
import {NailgunUnavailabilityDialog} from 'views/dialogs';
import KeystoneClient from 'keystone_client';
import RootComponent from 'views/root';
import LoginPage from 'views/login_page.js';
import WelcomePage from 'views/welcome_page';
import ClusterPage from 'views/cluster_page';
import ClustersPage from 'views/clusters_page';
import EquipmentPage from 'views/equipment_page';
import ReleasesPage from 'views/releases_page';
import PluginsPage from 'views/plugins_page';
import NotificationsPage from 'views/notifications_page';
import SupportPage from 'views/support_page';
import CapacityPage from 'views/capacity_page';
import 'backbone.routefilter';
import 'bootstrap';
import './styles/main.less';

class Router extends Backbone.Router {
  routes() {
    return {
      login: 'login',
      logout: 'logout',
      welcome: 'welcome',
      clusters: 'listClusters',
      'cluster/:id(/:tab)(/:opt1)(/:opt2)': 'showCluster',
      equipment: 'showEquipmentPage',
      releases: 'listReleases',
      plugins: 'listPlugins',
      notifications: 'showNotifications',
      support: 'showSupportPage',
      capacity: 'showCapacityPage',
      '*default': 'default'
    };
  }

  // pre-route hook
  before(currentRouteName) {
    var currentUrl = Backbone.history.getHash();
    var preventRouting = false;
    // remove trailing slash
    if (_.endsWith(currentUrl, '/')) {
      this.navigate(currentUrl.substr(0, currentUrl.length - 1), {trigger: true, replace: true});
      preventRouting = true;
    }
    // handle special routes
    if (!preventRouting) {
      var specialRoutes = [
        {name: 'login', condition: () => {
          var result = app.version.get('auth_required') && !app.user.get('authenticated');
          if (result && currentUrl !== 'login' && currentUrl !== 'logout') {
            this.returnUrl = currentUrl;
          }
          return result;
        }},
        {name: 'welcome', condition: (previousUrl) => {
          return previousUrl !== 'logout' &&
            !app.fuelSettings.get('statistics.user_choice_saved.value');
        }}
      ];
      _.each(specialRoutes, (route) => {
        if (route.condition(currentRouteName)) {
          if (currentRouteName !== route.name) {
            preventRouting = true;
            this.navigate(route.name, {trigger: true, replace: true});
          }
          return false;
        } else if (currentRouteName === route.name) {
          preventRouting = true;
          this.navigate('', {trigger: true});
          return false;
        }
      });
    }
    return !preventRouting;
  }

  // routes
  default() {
    this.navigate('clusters', {trigger: true, replace: true});
  }

  login() {
    app.loadPage(LoginPage);
  }

  logout() {
    app.logout();
  }

  welcome() {
    app.loadPage(WelcomePage);
  }

  showCluster(clusterId, tab) {
    var tabs = _.pluck(ClusterPage.getTabs(), 'url');
    if (!tab || !_.contains(tabs, tab)) {
      this.navigate('cluster/' + clusterId + '/' + tabs[0], {trigger: true, replace: true});
    } else {
      app.loadPage(ClusterPage, arguments).fail(() => this.default());
    }
  }

  listClusters() {
    app.loadPage(ClustersPage);
  }

  showEquipmentPage() {
    app.loadPage(EquipmentPage);
  }

  listReleases() {
    app.loadPage(ReleasesPage);
  }

  listPlugins() {
    app.loadPage(PluginsPage);
  }

  showNotifications() {
    app.loadPage(NotificationsPage);
  }

  showSupportPage() {
    app.loadPage(SupportPage);
  }

  showCapacityPage() {
    app.loadPage(CapacityPage);
  }
}

class App {
  constructor() {
    this.initialized = false;

    // this is needed for IE,
    // which caches requests resulting in wrong results (e.g /ostf/testruns/last/1)
    $.ajaxSetup({cache: false});

    this.overrideBackboneSyncMethod();

    this.router = new Router();
    this.version = new models.FuelVersion();
    this.fuelSettings = new models.FuelSettings();
    this.user = new models.User();
    this.nodeStatistics = new models.NodeStatistics();
    this.notificationStatistics = new models.NotificationStatistics();
    this.releases = new models.Releases();
    this.keystoneClient = new KeystoneClient('/keystone');
  }

  initialize() {
    this.initialized = true;
    this.mountNode = $('#main-container');

    document.title = i18n('common.title');

    this.version.set({auth_required: true});
    this.user.set({authenticated: false});

    var isNailgunAvailable = true;

    return this.version.fetch()
      .then(null, (response) => {
        if (response.status !== 401) {
          isNailgunAvailable = false;
        }
        return $.Deferred().reject(response);
      })
      .then(() => {
        this.user.set({authenticated: true});
        if (this.version.get('auth_required')) {
          return this.keystoneClient.getTokenInfo(this.user.get('token'))
            .done((tokenInfo) => {
              this.user.set({
                id: tokenInfo.token.user.id,
                roles: tokenInfo.token.roles
              });
            })
            .fail(() => {
              this.user.set({authenticated: false});
              this.user.unset('token');
              this.user.unset('username');
              return $.Deferred().reject();
            });
        } else {
          return $.Deferred().resolve();
        }
      })
      .then(() => this.fuelSettings.fetch())
      .then(null, () => {
        if (isNailgunAvailable) {
          return $.Deferred().resolve();
        } else {
          this.mountNode.empty();
          NailgunUnavailabilityDialog.show({}, {preventDuplicate: true});
        }
      })
      .then(() => Backbone.history.start());
  }

  renderLayout() {
    var wrappedRootComponent = ReactDOM.render(
      React.createElement(
        RootComponent,
        _.pick(this,
          'version', 'user', 'fuelSettings', 'nodeStatistics', 'notificationStatistics'
        )
      ),
      this.mountNode[0]
    );
    // RootComponent is wrapped with React-DnD, extracting link to it using ref
    this.rootComponent = wrappedRootComponent.refs.child;
  }

  loadPage(Page, options = []) {
    dispatcher.trigger('pageLoadStarted');
    return (Page.fetchData ? Page.fetchData(...options) : $.Deferred().resolve())
      .done((pageOptions) => {
        if (!this.rootComponent) this.renderLayout();
        this.setPage(Page, pageOptions);
      })
      .always(() => dispatcher.trigger('pageLoadFinished'));
  }

  setPage(Page, options) {
    this.page = this.rootComponent.setPage(Page, options);
  }

  navigate(...args) {
    return this.router.navigate(...args);
  }

  logout() {
    if (this.user.get('authenticated') && this.version.get('auth_required')) {
      var token = this.user.get('token');

      this.user.set('authenticated', false);
      this.user.unset('token');
      this.user.unset('username');
      this.user.unset('id');
      this.user.unset('roles');

      this.keystoneClient.deauthenticate(token);
    }

    _.defer(() => this.navigate('login', {trigger: true, replace: true}));
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
      if (app.version.get('auth_required')) {
        options.headers = options.headers || {};
        options.headers['X-Auth-Token'] = app.user.get('token');
        return originalSyncMethod.call(this, method, model, options)
          .fail((response) => {
            if (response && response.status === 401) {
              app.logout();
            }
          });
      }
      return originalSyncMethod.call(this, method, model, options);
    };
    Backbone.sync.patched = true;
  }
}

window.app = new App();

$(() => app.initialize());

export default app;
