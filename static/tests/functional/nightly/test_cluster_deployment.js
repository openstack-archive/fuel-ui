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
  var common, clusterPage, networksLib, dashboardPage, dashboardLib, nodesLib, node, modal,
    clusterName, controllers, computes, totalNodesAmount, nodeStatuses, clusterStatuses,
    timeout;

  return {
    name: 'Cluster deployment',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      dashboardPage = new DashboardPage(this.remote);
      nodesLib = new NodesLib(this.remote);
      networksLib = new NetworksLib(this.remote);
      dashboardLib = new DashboardLib(this.remote);
      node = new NodeComponent(this.remote);
      modal = new ModalWindow(this.remote);

      clusterName = common.pickRandomName('Test Cluster');

      timeout = 90000; // tests in the suite include long runnning cluster tasks

      controllers = ['Supermicro X9DRW', 'Dell Inspiron'];
      computes = ['Supermicro X9SCD'];
      totalNodesAmount = controllers.length + computes.length;

      nodeStatuses = {
        ready: 'ready',
        provisioned: 'provisioned',
        new: 'pending_addition'
      };

      clusterStatuses = {
        operational: 'Operational',
        partially_deployed: 'Partially Deployed'
      };

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName));
    },
    afterEach() {
      // do clean-up after each test to make them independent
      return this.remote
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => clusterPage.resetEnvironment(clusterName))
        .then(() => dashboardPage.discardChanges());
    },
    'Check deployment/provisioning with node in "Offline"/"Error" state'() {
      this.timeout = timeout;
      var offlineNodesAmount = 1;
      var errorNodesAmount = 1;

      return this.remote
        .then(() => common.addNodesToCluster(offlineNodesAmount, ['Controller'], 'offline'))
        .then(() => common.addNodesToCluster(errorNodesAmount, ['Controller'], 'error'))
        .then(() => common.addNodesToCluster(computes.length, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        // Check deployment modes
        .then(() => dashboardLib.checkDeployModeState(
          totalNodesAmount, offlineNodesAmount, errorNodesAmount, 0, 0
        ))
        .then(() => dashboardLib.changeDeploymentMode('Provision'))
        .then(() => dashboardLib.checkProvisionModeState(
          totalNodesAmount, offlineNodesAmount, errorNodesAmount, 0, 0
        ))
        .then(() => dashboardLib.changeDeploymentMode('Deployment'))
        .then(() => dashboardLib.checkDeploymentModeState(
          totalNodesAmount, offlineNodesAmount, errorNodesAmount, 0, 0
        ))
        .then(() => dashboardLib.changeDeploymentMode('Deploy'));
    },
    'Check that "Regular deployment" works as expected'() {
      this.timeout = timeout;
      var provisionedNodesAmount = 1;

      return this.remote
        .then(() => common.addNodesToCluster(controllers.length, ['Controller']))
        .then(() => common.addNodesToCluster(computes.length, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        // Provision part of nodes
        .then(() => dashboardLib.changeDeploymentMode('Provision'))
        .then(() => dashboardLib.selectNodes(
          'Provision', controllers.length, computes.length, provisionedNodesAmount, 0
        ))
        .then(() => dashboardLib.provisionNodes(
          clusterName, totalNodesAmount, 0, 0, provisionedNodesAmount, 0
        ))
        .then(() => dashboardLib.checkDeployModeState(
          totalNodesAmount, 0, 0, provisionedNodesAmount, 0
        ))
        // Check "Regular deployment"
        .then(() => dashboardLib.deployNodes(
          clusterName, totalNodesAmount, 0, 0, provisionedNodesAmount, 0
        ))
        .then(() => dashboardLib.checkDeployModeState(
          totalNodesAmount, 0, 0, provisionedNodesAmount, totalNodesAmount
        ))
        .then(() => nodesLib.checkDeployResults(
          controllers[0], nodeStatuses.ready, controllers[1],
          nodeStatuses.ready, computes[0], nodeStatuses.ready,
          clusterName, clusterStatuses.operational
        ));
    },
    'Check node selection dialog supports Quick Search, Sorting and Filtering'() {
      this.timeout = timeout;
      var provisionedControllerAmount = 1;
      var provisionedComputeAmount = 1;
      var provisionedNodesAmount = provisionedControllerAmount + provisionedComputeAmount;
      var deployedControllerAmount = 1;

      return this.remote
        .then(() => common.addNodesToCluster(controllers.length, ['Controller']))
        .then(() => common.addNodesToCluster(computes.length, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        // Provision part of nodes
        .then(() => dashboardLib.changeDeploymentMode('Provision'))
        .then(() => dashboardLib.selectNodes(
          'Provision', controllers.length, computes.length,
          provisionedControllerAmount, provisionedComputeAmount,
          [controllers[0], computes[0], ['input[name="error"]']]
        ))
        .then(() => dashboardLib.provisionNodes(
          clusterName, totalNodesAmount, 0, 0, provisionedNodesAmount, 0
        ))
        .then(() => dashboardLib.checkDeployModeState(
          totalNodesAmount, 0, 0, provisionedNodesAmount, 0
        ))
        .then(() => nodesLib.checkDeployResults(
          controllers[0], nodeStatuses.provisioned, controllers[1],
          nodeStatuses.new, computes[0], nodeStatuses.provisioned,
          clusterName, clusterStatuses.partially_deployed
        ))
        // Deploy part of nodes
        .then(() => dashboardLib.changeDeploymentMode('Deployment'))
        .then(() => dashboardLib.selectNodes(
          'Deployment', provisionedControllerAmount,
          provisionedComputeAmount, deployedControllerAmount, 0,
          [controllers[0], computes[0], ['input[name="error"]']]
        ))
        .then(() => dashboardLib.deployOnlyNodes(
          clusterName, totalNodesAmount, 0, 0, provisionedNodesAmount, deployedControllerAmount
        ))
        .then(() => dashboardLib.checkDeployModeState(
          totalNodesAmount, 0, 0, provisionedControllerAmount, deployedControllerAmount
        ))
        .then(() => nodesLib.checkDeployResults(
          controllers[0], nodeStatuses.ready, controllers[1],
          nodeStatuses.new, computes[0], nodeStatuses.provisioned,
          clusterName, clusterStatuses.partially_deployed
        ));
    },
    'Check that "Regular deployment" works as expected for provisioned/deployed part of nodes'() {
      this.timeout = timeout;

      return this.remote
        .then(() => dashboardLib.deployNodes(
          clusterName, totalNodesAmount, 0, 0, 1, 1
        ))
        .then(() => dashboardLib.checkDeployModeState(
          totalNodesAmount, 0, 0, 0, totalNodesAmount
        ))
        .then(() => nodesLib.checkDeployResults(
          controllers[0], nodeStatuses.ready, controllers[1],
          nodeStatuses.ready, computes[0], nodeStatuses.ready,
          clusterName, clusterStatuses.operational
        ));
    },
    'Check that "Provisioning only" works as expected'() {
      this.timeout = timeout;
      var provisionedNodesAmount = 3;

      return this.remote
        .then(() => common.addNodesToCluster(controllers.length, ['Controller']))
        .then(() => common.addNodesToCluster(computes.length, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        // Check "Provisioning only"
        .then(() => dashboardLib.checkDeployModeState(totalNodesAmount, 0, 0, 0, 0))
        .then(() => dashboardLib.changeDeploymentMode('Provision'))
        .then(() => dashboardLib.checkProvisionModeState(totalNodesAmount, 0, 0, 0, 0))
        .then(() => dashboardLib.provisionNodes(
          clusterName, totalNodesAmount, 0, 0, provisionedNodesAmount, 0
        ))
        .then(() => dashboardLib.checkDeployModeState(
          totalNodesAmount, 0, 0, provisionedNodesAmount, 0
        ))
        .then(() => dashboardLib.changeDeploymentMode('Provision'))
        .then(() => dashboardLib.checkProvisionModeState(
          totalNodesAmount, 0, 0, provisionedNodesAmount, 0
        ))
        .then(() => nodesLib.checkDeployResults(
          controllers[0], nodeStatuses.provisioned, controllers[1],
          nodeStatuses.provisioned, computes[0], nodeStatuses.provisioned,
          clusterName, clusterStatuses.partially_deployed
        ))
        // Check that user can add and rename new node network group after "Provisioning only"
        .then(() => clusterPage.goToTab('Networks'))
        .then(() => networksLib.createNetworkGroup('Network_Group_1'))
        .then(() => networksLib.renameNetworkGroup('Network_Group_1', 'Network_Group_2'));
    },
    'Check that "Deployment only" works as expected'() {
      this.timeout = timeout;
      var provisionedNodesAmount = 3;
      var deployedNodesAmount = 3;

      return this.remote
        .then(() => dashboardLib.changeDeploymentMode('Deployment'))
        .then(() => dashboardLib.checkDeploymentModeState(
          totalNodesAmount, 0, 0, provisionedNodesAmount, 0
        ))
        .then(() => dashboardLib.deployOnlyNodes(
          clusterName, totalNodesAmount, 0, 0, provisionedNodesAmount, deployedNodesAmount
        ))
        .then(() => dashboardLib.checkDeployModeState(
          totalNodesAmount, 0, 0, provisionedNodesAmount, deployedNodesAmount
        ))
        .then(() => nodesLib.checkDeployResults(
          controllers[0], nodeStatuses.ready, controllers[1],
          nodeStatuses.ready, computes[0], nodeStatuses.ready,
          clusterName, clusterStatuses.operational
        ))
        // Check that user can add and rename new node network group after "Deployment only"
        .then(() => clusterPage.goToTab('Networks'))
        .then(() => networksLib.createNetworkGroup('Network_Group_1'))
        .then(() => networksLib.renameNetworkGroup('Network_Group_1', 'Network_Group_3'));
    },
    'Check Virt role provisioning'() {
      this.timeout = timeout;
      var vmConfigJson = '[{"id":1,"mem":2,"cpu":2}]';
      var paneName = '"VMs provisioning"';

      return this.remote
        .then(() => common.addNodesToCluster(1, ['Compute', 'Virtual']))
        // Config VM
        .then(() => node.openNodePopup(false))
        .clickByCssSelector('#headingconfig')
        .setInputValue('.form-group [type=textarea]', vmConfigJson)
        .clickByCssSelector('.vms-config button.btn-success')
        .then(() => modal.close())
        .then(() => clusterPage.goToTab('Dashboard'))
        // Provision and deploy compute, virt node
        .clickByCssSelector('button.btn-provision-vms')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Provision VMs'))
        .then(() => modal.clickFooterButton('Start'))
        .then(() => modal.waitToClose())
        .assertElementAppears(
          'div.dashboard-tab div.progress', 5000, paneName + ' is started'
        )
        .assertElementDisappears(
          'div.dashboard-tab div.progress', 45000, paneName + ' is finished'
        )
        .assertElementAppears(
          'div.dashboard-tab div.alert', 1000, paneName + ' result pane appears'
        )
        .assertElementMatchesRegExp(
          'div.dashboard-tab div.alert strong', RegExp('Success', 'i'),
          paneName + ' result pane message is correct'
        )
        .assertElementMatchesRegExp(
          'div.dashboard-tab div.alert span', RegExp('Provision of', 'i'),
          paneName + ' result pane message is correct'
        );
    }
  };
});
