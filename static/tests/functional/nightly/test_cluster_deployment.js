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
import NodeComponent from 'tests/functional/pages/node';
import ModalWindow from 'tests/functional/pages/modal';
import NodesLib from 'tests/functional/nightly/library/nodes';
import NetworksLib from 'tests/functional/nightly/library/networks';
import DashboardLib from 'tests/functional/nightly/library/dashboard';

registerSuite(() => {
  var common, clusterPage, clusterName, node, modal, networksLib, dashboardPage, dashboardLib,
    nodesLib;
  var controllerNodesAmount = 2;
  var computeNodesAmount = 1;
  var totalNodesAmount = controllerNodesAmount + computeNodesAmount;
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
      this.timeout = 45000;
      var offlineNodesAmount = 1;
      var errorNodesAmount = 1;
      return this.remote
        // Precondition
        .then(() => common.addNodesToCluster(offlineNodesAmount, ['Controller'], 'offline'))
        .then(() => common.addNodesToCluster(errorNodesAmount, ['Controller'], 'error'))
        .then(() => common.addNodesToCluster(computeNodesAmount, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        // Check deployment modes
        .then(() => dashboardLib.checkDeployModeState(totalNodesAmount, offlineNodesAmount,
          errorNodesAmount, 0, 0))
        .then(() => dashboardLib.changeDeploymentMode('Provision'))
        .then(() => dashboardLib.checkProvisionModeState(totalNodesAmount, offlineNodesAmount,
          errorNodesAmount, 0, 0))
        .then(() => dashboardLib.changeDeploymentMode('Deployment'))
        .then(() => dashboardLib.checkDeploymentModeState(totalNodesAmount, offlineNodesAmount,
          errorNodesAmount, 0, 0))
        .then(() => dashboardLib.changeDeploymentMode('Deploy'));
    },
    'Check that "Regular deployment" works as expected'() {
      this.timeout = 75000;
      var provisionNodesAmount = 1;
      var nodeStatus = 'ready';
      var clusterStatus = 'Operational';
      return this.remote
        // Precondition
        .then(() => clusterPage.resetEnvironment(clusterName))
        .then(() => dashboardPage.discardChanges())
        .then(() => common.addNodesToCluster(controllerNodesAmount, ['Controller']))
        .then(() => common.addNodesToCluster(computeNodesAmount, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        // Provision part of nodes
        .then(() => dashboardLib.changeDeploymentMode('Provision'))
        .then(() => dashboardLib.selectNodes('Provision', controllerNodesAmount, computeNodesAmount,
          provisionNodesAmount, 0))
        .then(() => dashboardLib.provisionNodes(clusterName, totalNodesAmount, 0, 0,
          provisionNodesAmount, 0))
        .then(() => dashboardLib.checkDeployModeState(totalNodesAmount, 0, 0,
          provisionNodesAmount, 0))
        // Check "Regular deployment"
        .then(() => dashboardLib.deployNodes(clusterName, totalNodesAmount, 0, 0,
          provisionNodesAmount, 0))
        .then(() => dashboardLib.checkDeployModeState(totalNodesAmount, 0, 0,
          provisionNodesAmount, totalNodesAmount))
        .then(() => nodesLib.checkDeployResults(controller1Name, nodeStatus, controller2Name,
          nodeStatus, computeName, nodeStatus, clusterName, clusterStatus));
    },
    'Check nodes selection dialog supports Quick Search, Sorting and Filtering'() {
      this.timeout = 90000;
      var provisionControllerAmount = 1;
      var provisionComputeAmount = 1;
      var provisionNodesAmount = provisionControllerAmount + provisionComputeAmount;
      var deployControllerAmount = 1;
      var deepCheck = [controller1Name, computeName, ['input[name="error"]']];
      var initialStatus = 'pending_addition';
      var provisionStatus = 'provisioned';
      var readyStatus = 'ready';
      var clusterStatus = 'Partially Deployed';
      return this.remote
        // Precondition
        .then(() => clusterPage.resetEnvironment(clusterName))
        .then(() => dashboardPage.discardChanges())
        .then(() => common.addNodesToCluster(controllerNodesAmount, ['Controller']))
        .then(() => common.addNodesToCluster(computeNodesAmount, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        // Provision part of nodes
        .then(() => dashboardLib.changeDeploymentMode('Provision'))
        .then(() => dashboardLib.selectNodes('Provision', controllerNodesAmount, computeNodesAmount,
          provisionControllerAmount, provisionComputeAmount, deepCheck))
        .then(() => dashboardLib.provisionNodes(clusterName, totalNodesAmount, 0, 0,
          provisionNodesAmount, 0))
        .then(() => dashboardLib.checkDeployModeState(totalNodesAmount, 0, 0,
          provisionNodesAmount, 0))
        .then(() => nodesLib.checkDeployResults(controller1Name, provisionStatus, controller2Name,
          initialStatus, computeName, provisionStatus, clusterName, clusterStatus))
        // Deploy part of nodes
        .then(() => dashboardLib.changeDeploymentMode('Deployment'))
        .then(() => dashboardLib.selectNodes('Deployment', provisionControllerAmount,
          provisionComputeAmount, deployControllerAmount, 0, deepCheck))
        .then(() => dashboardLib.deployOnlyNodes(clusterName, totalNodesAmount, 0, 0,
          provisionNodesAmount, deployControllerAmount))
        .then(() => dashboardLib.checkDeployModeState(totalNodesAmount, 0, 0,
          provisionControllerAmount, deployControllerAmount))
        .then(() => nodesLib.checkDeployResults(controller1Name, readyStatus, controller2Name,
          initialStatus, computeName, provisionStatus, clusterName, clusterStatus));
    },
    'Check that "Regular deployment" works as expected for provisioned/deployed part of nodes'() {
      this.timeout = 45000;
      var provisionNodesAmount = 1;
      var deployNodesAmount = 1;
      var nodeStatus = 'ready';
      var clusterStatus = 'Operational';
      return this.remote
        .then(() => dashboardLib.deployNodes(clusterName, totalNodesAmount, 0, 0,
          provisionNodesAmount, deployNodesAmount))
        .then(() => dashboardLib.checkDeployModeState(totalNodesAmount, 0, 0, 0, totalNodesAmount))
        .then(() => nodesLib.checkDeployResults(controller1Name, nodeStatus, controller2Name,
          nodeStatus, computeName, nodeStatus, clusterName, clusterStatus));
    },
    'Check that "Provisioning only" works as expected'() {
      this.timeout = 60000;
      var provisionNodesAmount = 3;
      var nodeStatus = 'provisioned';
      var clusterStatus = 'Partially Deployed';
      var newGroupName = 'Network_Group_1';
      var renameGroupName = 'Network_Group_2';
      return this.remote
        // Precondition
        .then(() => clusterPage.resetEnvironment(clusterName))
        .then(() => dashboardPage.discardChanges())
        .then(() => common.addNodesToCluster(controllerNodesAmount, ['Controller']))
        .then(() => common.addNodesToCluster(computeNodesAmount, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        // Check "Provisioning only"
        .then(() => dashboardLib.checkDeployModeState(totalNodesAmount, 0, 0, 0, 0))
        .then(() => dashboardLib.changeDeploymentMode('Provision'))
        .then(() => dashboardLib.checkProvisionModeState(totalNodesAmount, 0, 0, 0, 0))
        .then(() => dashboardLib.provisionNodes(clusterName, totalNodesAmount, 0, 0,
          provisionNodesAmount, 0))
        .then(() => dashboardLib.checkDeployModeState(totalNodesAmount, 0, 0,
          provisionNodesAmount, 0))
        .then(() => dashboardLib.changeDeploymentMode('Provision'))
        .then(() => dashboardLib.checkProvisionModeState(totalNodesAmount, 0, 0,
          provisionNodesAmount, 0))
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
      this.timeout = 45000;
      var provisionNodesAmount = 3;
      var deployNodesAmount = 3;
      var nodeStatus = 'ready';
      var clusterStatus = 'Operational';
      var newGroupName = 'Network_Group_1';
      var renameGroupName = 'Network_Group_3';
      return this.remote
        // Check "Deployment only"
        .then(() => dashboardLib.changeDeploymentMode('Deployment'))
        .then(() => dashboardLib.checkDeploymentModeState(totalNodesAmount, 0, 0,
          provisionNodesAmount, 0))
        .then(() => dashboardLib.deployOnlyNodes(clusterName, totalNodesAmount, 0, 0,
          provisionNodesAmount, deployNodesAmount))
        .then(() => dashboardLib.checkDeployModeState(totalNodesAmount, 0, 0,
          provisionNodesAmount, deployNodesAmount))
        .then(() => nodesLib.checkDeployResults(controller1Name, nodeStatus, controller2Name,
          nodeStatus, computeName, nodeStatus, clusterName, clusterStatus))
        // Check that user can add and rename new node network group after "Provisioning only"
        .then(() => clusterPage.goToTab('Networks'))
        .then(() => networksLib.createNetworkGroup(newGroupName))
        .then(() => networksLib.renameNetworkGroup(newGroupName, renameGroupName));
    },
    'Check Virt role provisioning'() {
      this.timeout = 60000;
      var provisionNodesAmount = 1;
      var vmConfigPanel = '#headingconfig';
      var vmConfigField = '.form-group [type=textarea]';
      var vmConfigJson = '[{"id":1,"mem":2,"cpu":2}]';
      var btnSaveSelector = '.vms-config button.btn-success';
      node = new NodeComponent(this.remote);
      modal = new ModalWindow(this.remote);
      return this.remote
        // Add node woth compute, virtual role
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => clusterPage.resetEnvironment(clusterName))
        .then(() => dashboardPage.discardChanges())
        .then(() => common.addNodesToCluster(provisionNodesAmount, ['Compute', 'Virtual']))
        // Config VM
        .then(() => clusterPage.goToTab('Nodes'))
        .then(() => node.openNodePopup(false))
        .clickByCssSelector(vmConfigPanel)
        .setInputValue(vmConfigField, vmConfigJson)
        .clickByCssSelector(btnSaveSelector)
        .then(() => modal.close())
        .then(() => clusterPage.goToTab('Dashboard'))
        // Provision and deploy compute, virt node
        .then(() => dashboardLib.provisionVM());
    }
  };
});
