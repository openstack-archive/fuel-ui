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

import registerSuite from 'intern!object';
import Common from 'tests/functional/pages/common';
import ClusterPage from 'tests/functional/pages/cluster';
import DashboardPage from 'tests/functional/pages/dashboard';
import NetworksLib from 'tests/functional/nightly/library/networks';
import DashboardLib from 'tests/functional/nightly/library/dashboard';
import NodesLib from 'tests/functional/nightly/library/nodes';

registerSuite(() => {
  var common, clusterPage, clusterName, networksLib, dashboardPage, dashboardLib, nodesLib;
  var contrNodes = 2;
  var compNodes = 1;
  var totalNodes = contrNodes + compNodes;
  var controller1Name = 'Supermicro X9DRW';
  var controller2Name = 'Dell Inspiron';
  var computeName = 'Supermicro X9SCD';

  return {
    name: 'Cluster deployment',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      networksLib = new NetworksLib(this.remote);
      dashboardPage = new DashboardPage(this.remote);
      dashboardLib = new DashboardLib(this.remote);
      nodesLib = new NodesLib(this.remote);
      clusterName = common.pickRandomName('Test Cluster');

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName));
    },
    'Check deployment/provisioning with node in "Offline"/"Error" state'() {
      var offline = 1;
      var error = 1;
      return this.remote
        // Precondition
        .then(() => common.addNodesToCluster(offline, ['Controller'], 'offline'))
        .then(() => common.addNodesToCluster(error, ['Controller'], 'error'))
        .then(() => common.addNodesToCluster(1, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        // Check deployment modes
        .then(() => dashboardLib.checkDeployModeState(totalNodes, offline, error, 0, 0))
        .then(() => dashboardLib.changeDeploymentMode('Provision'))
        .then(() => dashboardLib.checkProvisionModeState(totalNodes, offline, error, 0, 0))
        .then(() => dashboardLib.changeDeploymentMode('Deployment'))
        .then(() => dashboardLib.checkDeploymentModeState(totalNodes, offline, error, 0, 0))
        .then(() => dashboardLib.changeDeploymentMode('Deploy'));
    },
    'Check that "Regular deployment" worked as expected'() {
      this.timeout = 75000;
      var provisNodes = 1;
      var nodeStatus = 'ready';
      var clusterStatus = 'Operational';
      return this.remote
        // Precondition
        .then(() => clusterPage.resetEnvironment(clusterName))
        .then(() => dashboardPage.discardChanges())
        .then(() => common.addNodesToCluster(contrNodes, ['Controller']))
        .then(() => common.addNodesToCluster(compNodes, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        // Provision part of nodes
        .then(() => dashboardLib.changeDeploymentMode('Provision'))
        .then(() => dashboardLib.selectNodes('Provision', contrNodes, compNodes, provisNodes, 0))
        .then(() => dashboardLib.provisionNodes(clusterName, totalNodes, 0, 0, provisNodes, 0))
        .then(() => dashboardLib.checkDeployModeState(totalNodes, 0, 0, provisNodes, 0))
        // Check "Regular deployment"
        .then(() => dashboardLib.deployNodes(clusterName, totalNodes, 0, 0, provisNodes, 0))
        .then(() => dashboardLib.checkDeployModeState(totalNodes, 0, 0, provisNodes, totalNodes))
        .then(() => nodesLib.checkDeployResults(controller1Name, nodeStatus, controller2Name,
          nodeStatus, computeName, nodeStatus, clusterName, clusterStatus));
    },
    'Check nodes selection dialog support Quick Search, Sorting and Filtering'() {
      this.timeout = 75000;
      var provisContr = 1;
      var provisComp = 1;
      var provisNodes = provisContr + provisComp;
      var deployContr = 1;
      var deepCheck = [controller1Name, computeName, ['input[name="error"]']];
      var initStatus = 'pending_addition';
      var provisStatus = 'provisioned';
      var readyStatus = 'ready';
      var clusterStatus = 'Partially Deployed';
      return this.remote
        // Precondition
        .then(() => clusterPage.resetEnvironment(clusterName))
        .then(() => dashboardPage.discardChanges())
        .then(() => common.addNodesToCluster(contrNodes, ['Controller']))
        .then(() => common.addNodesToCluster(compNodes, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        // Provision part of nodes
        .then(() => dashboardLib.changeDeploymentMode('Provision'))
        .then(() => dashboardLib.selectNodes('Provision', contrNodes, compNodes, provisContr,
          provisComp, deepCheck))
        .then(() => dashboardLib.provisionNodes(clusterName, totalNodes, 0, 0, provisNodes, 0))
        .then(() => dashboardLib.checkDeployModeState(totalNodes, 0, 0, provisNodes, 0))
        .then(() => nodesLib.checkDeployResults(controller1Name, provisStatus, controller2Name,
          initStatus, computeName, provisStatus, clusterName, clusterStatus))
        // Deploy part of nodes
        .then(() => dashboardLib.changeDeploymentMode('Deployment'))
        .then(() => dashboardLib.selectNodes('Deployment', provisContr, provisComp, deployContr, 0,
            deepCheck))
        .then(() => dashboardLib.deployOnlyNodes(clusterName, totalNodes, 0, 0, provisNodes,
          deployContr))
        .then(() => dashboardLib.checkDeployModeState(totalNodes, 0, 0, provisContr, deployContr))
        .then(() => nodesLib.checkDeployResults(controller1Name, readyStatus, controller2Name,
          initStatus, computeName, provisStatus, clusterName, clusterStatus));
    },
    'Check that "Regular deployment" worked as expected for provisioned/deployed part of nodes'() {
      var provisNodes = 1;
      var deployNodes = 1;
      var nodeStatus = 'ready';
      var clusterStatus = 'Operational';
      return this.remote
        .then(() => dashboardLib.deployNodes(clusterName, totalNodes, 0, 0, provisNodes,
          deployNodes))
        .then(() => dashboardLib.checkDeployModeState(totalNodes, 0, 0, 0, totalNodes))
        .then(() => nodesLib.checkDeployResults(controller1Name, nodeStatus, controller2Name,
          nodeStatus, computeName, nodeStatus, clusterName, clusterStatus));
    },
    'Check that "Provisioning only" worked as expected'() {
      this.timeout = 45000;
      var provisionNodes = 3;
      var nodeStatus = 'provisioned';
      var clusterStatus = 'Partially Deployed';
      var newGroupName = 'Network_Group_1';
      var renameGroupName = 'Network_Group_2';
      return this.remote
        // Precondition
        .then(() => clusterPage.resetEnvironment(clusterName))
        .then(() => dashboardPage.discardChanges())
        .then(() => common.addNodesToCluster(contrNodes, ['Controller']))
        .then(() => common.addNodesToCluster(compNodes, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        // Check "Provisioning only"
        .then(() => dashboardLib.checkDeployModeState(totalNodes, 0, 0, 0, 0))
        .then(() => dashboardLib.changeDeploymentMode('Provision'))
        .then(() => dashboardLib.checkProvisionModeState(totalNodes, 0, 0, 0, 0))
        .then(() => dashboardLib.provisionNodes(clusterName, totalNodes, 0, 0, provisionNodes, 0))
        .then(() => dashboardLib.checkDeployModeState(totalNodes, 0, 0, provisionNodes, 0))
        .then(() => dashboardLib.changeDeploymentMode('Provision'))
        .then(() => dashboardLib.checkProvisionModeState(totalNodes, 0, 0, provisionNodes, 0))
        .then(() => nodesLib.checkDeployResults(controller1Name, nodeStatus, controller2Name,
          nodeStatus, computeName, nodeStatus, clusterName, clusterStatus))
        // Check that user can add and rename new node network group after "Provisioning only"
        .then(() => clusterPage.goToTab('Networks'))
        .then(() => networksLib.createNetworkGroup(newGroupName))
        .then(() => networksLib.renameNetworkGroup(newGroupName, renameGroupName))
        // Postcondition
        .then(() => clusterPage.goToTab('Dashboard'));
    },
    'Check that "Deployment only" worked as expected'() {
      var total = totalNodes;
      var provNodes = 3;
      var depNodes = 3;
      var nodeStatus = 'ready';
      var clusterStatus = 'Operational';
      var newGroupName = 'Network_Group_1';
      var renameGroupName = 'Network_Group_3';
      return this.remote
        // Check "Deployment only"
        .then(() => dashboardLib.changeDeploymentMode('Deployment'))
        .then(() => dashboardLib.checkDeploymentModeState(total, 0, 0, provNodes, 0))
        .then(() => dashboardLib.deployOnlyNodes(clusterName, total, 0, 0, provNodes, depNodes))
        .then(() => dashboardLib.checkDeployModeState(total, 0, 0, provNodes, depNodes))
        .then(() => nodesLib.checkDeployResults(controller1Name, nodeStatus, controller2Name,
          nodeStatus, computeName, nodeStatus, clusterName, clusterStatus))
        // Check that user can add and rename new node network group after "Provisioning only"
        .then(() => clusterPage.goToTab('Networks'))
        .then(() => networksLib.createNetworkGroup(newGroupName))
        .then(() => networksLib.renameNetworkGroup(newGroupName, renameGroupName));
    }
  };
});
