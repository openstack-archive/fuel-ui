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

import _ from 'intern/dojo/node!lodash';
import LoginPage from 'tests/functional/pages/login';
import WelcomePage from 'tests/functional/pages/welcome';
import ClusterPage from 'tests/functional/pages/cluster';
import ClustersPage from 'tests/functional/pages/clusters';
import 'tests/functional/helpers';

function CommonMethods(remote) {
  this.remote = remote;
  this.loginPage = new LoginPage(remote);
  this.welcomePage = new WelcomePage(remote);
  this.clusterPage = new ClusterPage(remote);
  this.clustersPage = new ClustersPage(remote);
}

CommonMethods.prototype = {
  constructor: CommonMethods,
  pickRandomName: function(prefix) {
    return _.uniqueId((prefix || 'Item') + ' #');
  },
  getOut: function() {
    return this.remote
      .then(() => this.welcomePage.skip())
      .then(() => this.loginPage.logout());
  },
  getIn: function() {
    return this.remote
      .then(() => this.loginPage.logout())
      .then(() => this.loginPage.login())
      .waitForElementDeletion('.login-btn', 2000)
      .then(() => this.welcomePage.skip())
      .waitForCssSelector('.navbar-nav', 1000)
      .clickByCssSelector('.global-alert.alert-warning .close');
  },
  createCluster: function(clusterName, stepsMethods) {
    return this.remote
      .clickLinkByText('Environments')
      .waitForCssSelector('.clusters-page', 2000)
      .then(() => this.clustersPage.createCluster(clusterName, stepsMethods));
  },
  removeCluster: function(clusterName, suppressErrors) {
    return this.remote
      .clickLinkByText('Environments')
      .waitForCssSelector('.clusters-page', 2000)
      .then(() => this.clustersPage.goToEnvironment(clusterName))
      .then(() => this.clusterPage.removeCluster(clusterName))
      .catch((e) => {
        if (!suppressErrors) {
          throw new Error('Unable to delete cluster ' + clusterName + ': ' + e);
        }
      });
  },
  doesClusterExist: function(clusterName) {
    return this.remote
      .clickLinkByText('Environments')
      .waitForCssSelector('.clusters-page', 2000)
      .findAllByCssSelector(this.clustersPage.clusterSelector)
        .then(
          (divs) => divs.reduce(
            (matchFound, element) => {
              return element.getVisibleText().then((name) => (name === clusterName) || matchFound);
            },
            false
          )
        );
  },
  addNodesToCluster: function(nodesAmount, nodesRoles, nodeStatus, nodeNameFilter) {
    return this.remote
      .then(() => this.clusterPage.goToTab('Nodes'))
      .waitForCssSelector('.btn-add-nodes', 3000)
      .clickByCssSelector('.btn-add-nodes')
      .waitForElementDeletion('.btn-add-nodes', 3000)
      .waitForCssSelector('.node', 3000)
      .then(() => {
        if (nodeNameFilter) return this.clusterPage.searchForNode(nodeNameFilter);
      })
      .then(() => this.clusterPage.checkNodeRoles(nodesRoles))
      .then(() => this.clusterPage.checkNodes(nodesAmount, nodeStatus))
      .clickByCssSelector('.btn-apply')
      .waitForElementDeletion('.btn-apply', 3000);
  }
};

export default CommonMethods;
