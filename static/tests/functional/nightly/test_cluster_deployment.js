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
import NodesLib from 'tests/functional/nightly/library/nodes';
import NetworksLib from 'tests/functional/nightly/library/networks';
import DashboardLib from 'tests/functional/nightly/library/dashboard';

registerSuite(() => {
  var common, clusterPage, clusterName, networksLib, dashboardPage, dashboardLib, nodesLib;
  var controllerNodes = 2;
  var computeNodes = 1;
  var totalNodes = controllerNodes + computeNodes;
  var controller1Name = 'Supermicro X9DRW';
  var controller2Name = 'Dell Inspiron';
  var computeName = 'Supermicro X9SCD';

  return {
    name: 'Cluster deployment',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      dashboardPage = new DashboardPage(this.remote);
      nodesLib = new NodesLib(this.remote);
      networksLib = new NetworksLib(this.remote);
      dashboardLib = new DashboardLib(this.remote);
      clusterName = common.pickRandomName('Test Cluster');

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName));
    },
    'Check deployment/provisioning with node in "Offline"/"Error" state'() {
      var offlineNodes = 1;
      var errorNodes = 1;
      return this.remote
        // Precondition
        .then(() => common.addNodesToCluster(offlineNodes, ['Controller'], 'offline'))
        .then(() => common.addNodesToCluster(errorNodes, ['Controller'], 'error'))
        .then(() => common.addNodesToCluster(computeNodes, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        // Check deployment modes
        .then(() => dashboardLib.checkDeployModeState(totalNodes, offlineNodes, errorNodes, 0, 0))
        .then(() => dashboardLib.changeDeploymentMode('Provision'))
        .then(() => dashboardLib.checkProvisionModeState(totalNodes, offlineNodes, errorNodes, 0,
          0))
        .then(() => dashboardLib.changeDeploymentMode('Deployment'))
        .then(() => dashboardLib.checkDeploymentModeState(totalNodes, offlineNodes, errorNodes, 0,
          0))
        .then(() => dashboardLib.changeDeploymentMode('Deploy'));
    },
    'Check that "Regular deployment" works as expected'() {
      this.timeout = 75000;
      var provisionNodes = 1;
      var nodeStatus = 'ready';
      var clusterStatus = 'Operational';
      return this.remote
        // Precondition
        .then(() => clusterPage.resetEnvironment(clusterName))
        .then(() => dashboardPage.discardChanges())
        .then(() => common.addNodesToCluster(controllerNodes, ['Controller']))
        .then(() => common.addNodesToCluster(computeNodes, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        // Provision part of nodes
        .then(() => dashboardLib.changeDeploymentMode('Provision'))
        .then(() => dashboardLib.selectNodes('Provision', controllerNodes, computeNodes,
          provisionNodes, 0))
        .then(() => dashboardLib.provisionNodes(clusterName, totalNodes, 0, 0, provisionNodes, 0))
        .then(() => dashboardLib.checkDeployModeState(totalNodes, 0, 0, provisionNodes, 0))
        // Check "Regular deployment"
        .then(() => dashboardLib.deployNodes(clusterName, totalNodes, 0, 0, provisionNodes, 0))
        .then(() => dashboardLib.checkDeployModeState(totalNodes, 0, 0, provisionNodes, totalNodes))
        .then(() => nodesLib.checkDeployResults(controller1Name, nodeStatus, controller2Name,
          nodeStatus, computeName, nodeStatus, clusterName, clusterStatus));
    },
    'Check nodes selection dialog supports Quick Search, Sorting and Filtering'() {
      this.timeout = 90000;
      var provisionController = 1;
      var provisionCompute = 1;
      var provisionNodes = provisionController + provisionCompute;
      var deployController = 1;
      var deepCheck = [controller1Name, computeName, ['input[name="error"]']];
      var initialStatus = 'pending_addition';
      var provisionStatus = 'provisioned';
      var readyStatus = 'ready';
      var clusterStatus = 'Partially Deployed';
      return this.remote
        // Precondition
        .then(() => clusterPage.resetEnvironment(clusterName))
        .then(() => dashboardPage.discardChanges())
        .then(() => common.addNodesToCluster(controllerNodes, ['Controller']))
        .then(() => common.addNodesToCluster(computeNodes, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        // Provision part of nodes
        .then(() => dashboardLib.changeDeploymentMode('Provision'))
        .then(() => dashboardLib.selectNodes('Provision', controllerNodes, computeNodes,
          provisionController, provisionCompute, deepCheck))
        .then(() => dashboardLib.provisionNodes(clusterName, totalNodes, 0, 0, provisionNodes, 0))
        .then(() => dashboardLib.checkDeployModeState(totalNodes, 0, 0, provisionNodes, 0))
        .then(() => nodesLib.checkDeployResults(controller1Name, provisionStatus, controller2Name,
          initialStatus, computeName, provisionStatus, clusterName, clusterStatus))
        // Deploy part of nodes
        .then(() => dashboardLib.changeDeploymentMode('Deployment'))
        .then(() => dashboardLib.selectNodes('Deployment', provisionController, provisionCompute,
          deployController, 0, deepCheck))
        .then(() => dashboardLib.deployOnlyNodes(clusterName, totalNodes, 0, 0, provisionNodes,
          deployController))
        .then(() => dashboardLib.checkDeployModeState(totalNodes, 0, 0, provisionController,
          deployController))
        .then(() => nodesLib.checkDeployResults(controller1Name, readyStatus, controller2Name,
          initialStatus, computeName, provisionStatus, clusterName, clusterStatus));
    },
    'Check that "Regular deployment" works as expected for provisioned/deployed part of nodes'() {
      var provisionNodes = 1;
      var deployNodes = 1;
      var nodeStatus = 'ready';
      var clusterStatus = 'Operational';
      return this.remote
        .then(() => dashboardLib.deployNodes(clusterName, totalNodes, 0, 0, provisionNodes,
          deployNodes))
        .then(() => dashboardLib.checkDeployModeState(totalNodes, 0, 0, 0, totalNodes))
        .then(() => nodesLib.checkDeployResults(controller1Name, nodeStatus, controller2Name,
          nodeStatus, computeName, nodeStatus, clusterName, clusterStatus));
    },
    'Check that "Provisioning only" worked as expected'() {
      this.timeout = 60000;
      var provisionNodes = 3;
      var nodeStatus = 'provisioned';
      var clusterStatus = 'Partially Deployed';
      var newGroupName = 'Network_Group_1';
      var renameGroupName = 'Network_Group_2';
      return this.remote
        // Precondition
        .then(() => clusterPage.resetEnvironment(clusterName))
        .then(() => dashboardPage.discardChanges())
        .then(() => common.addNodesToCluster(controllerNodes, ['Controller']))
        .then(() => common.addNodesToCluster(computeNodes, ['Compute']))
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
    'Check that "Deployment only" works as expected'() {
      var provisionNodes = 3;
      var deployNodes = 3;
      var nodeStatus = 'ready';
      var clusterStatus = 'Operational';
      var newGroupName = 'Network_Group_1';
      var renameGroupName = 'Network_Group_3';
      return this.remote
        // Check "Deployment only"
        .then(() => dashboardLib.changeDeploymentMode('Deployment'))
        .then(() => dashboardLib.checkDeploymentModeState(totalNodes, 0, 0, provisionNodes, 0))
        .then(() => dashboardLib.deployOnlyNodes(clusterName, totalNodes, 0, 0, provisionNodes,
          deployNodes))
        .then(() => dashboardLib.checkDeployModeState(totalNodes, 0, 0, provisionNodes,
          deployNodes))
        .then(() => nodesLib.checkDeployResults(controller1Name, nodeStatus, controller2Name,
          nodeStatus, computeName, nodeStatus, clusterName, clusterStatus))
        // Check that user can add and rename new node network group after "Provisioning only"
        .then(() => clusterPage.goToTab('Networks'))
        .then(() => networksLib.createNetworkGroup(newGroupName))
        .then(() => networksLib.renameNetworkGroup(newGroupName, renameGroupName));
    }
  };
});
