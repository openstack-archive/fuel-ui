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

import registerSuite from 'intern!object';
import Common from 'tests/functional/pages/common';
import ClusterPage from 'tests/functional/pages/cluster';
import ClustersPage from 'tests/functional/pages/clusters';
import DashboardPage from 'tests/functional/pages/dashboard';

registerSuite(() => {
  var common,
    clusterPage,
    clustersPage,
    dashboardPage,
    clusterName;

  return {
    name: 'Dashboard tab',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      clustersPage = new ClustersPage(this.remote);
      dashboardPage = new DashboardPage(this.remote);
      clusterName = common.pickRandomName('Test Cluster');

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName));
    },
    beforeEach() {
      return this.remote
        .then(() => clusterPage.goToTab('Dashboard'));
    },
    'Renaming cluster works'() {
      var initialName = clusterName;
      var newName = clusterName + '!!!';
      var renameInputSelector = '.rename-block input[type=text]';
      var nameSelector = '.cluster-info-value.name .btn-link';
      return this.remote
        .then(() => dashboardPage.startClusterRenaming())
        .findByCssSelector(renameInputSelector)
          // Escape
          .type('\uE00C')
          .end()
        .assertElementDisappears(renameInputSelector, 'Rename control disappears')
        .assertElementAppears(nameSelector, 'Cluster name appears')
        .assertElementTextEquals(
          nameSelector,
          initialName,
          'Switching rename control does not change cluster name'
        )
        .then(() => dashboardPage.setClusterName(newName))
        .assertElementTextEquals(nameSelector, newName, 'New name is applied')
        .then(() => dashboardPage.setClusterName(initialName))
        .then(() => common.createCluster(newName))
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardPage.setClusterName(initialName))
        .assertElementAppears(
          '.rename-block .has-error',
          1000,
          'Error style for duplicate name is applied'
        )
        .assertElementTextEquals(
          '.rename-block .help-block',
          'Environment with this name already exists',
          'Duplicate name error text appears'
        )
        .findByCssSelector(renameInputSelector)
          // Escape
          .type('\uE00C')
          .end()
        .clickLinkByText('Environments')
        .then(() => clustersPage.goToEnvironment(initialName));
    },
    'Provision VMs button availability'() {
      return this.remote
        .then(() => common.addNodesToCluster(1, ['Virtual']))
        .then(() => clusterPage.goToTab('Dashboard'))
        .assertElementAppears(
          '.actions-panel .btn-provision-vms',
          1000,
          'Provision VMs action appears on the Dashboard'
        )
        .clickByCssSelector('.actions-panel .dropdown button.dropdown-toggle')
        .clickByCssSelector('.actions-panel .dropdown .dropdown-menu li.deploy button')
        .then(() => dashboardPage.discardChanges());
    },
    'Network validation error warning'() {
      return this.remote
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => clusterPage.goToTab('Networks'))
        .clickByCssSelector('.subtab-link-network_verification')
        .assertElementContainsText(
          '.alert-warning',
          'At least two online nodes are required',
          'Network verification warning appears if only one node added'
        )
        .then(() => clusterPage.goToTab('Dashboard'))
        .assertElementContainsText(
          '.actions-panel .warnings-block',
          'Please verify your network settings before deployment',
          'Network verification warning is shown'
        )
        .then(() => dashboardPage.discardChanges());
    },
    'No controller warning'() {
      return this.remote
        .then(() => common.addNodesToCluster(1, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        .assertElementDisabled(
          dashboardPage.deployButtonSelector,
          'No deployment should be possible without controller nodes added'
        )
        .assertElementExists('div.instruction.invalid', 'Invalid configuration message is shown')
        .assertElementContainsText(
          '.task-alerts ul.text-danger li',
          'At least 1 Controller nodes are required (0 selected currently).',
          'No controllers added warning should be shown'
        )
        .then(() => dashboardPage.discardChanges());
    },
    'Capacity table tests'() {
      return this.remote
        .then(() => common.addNodesToCluster(1, ['Controller', 'Cinder']))
        .then(() => common.addNodesToCluster(2, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        .assertIsIntegerContentPositive('.capacity-items .cpu .capacity-value', 'CPU')
        .assertIsIntegerContentPositive('.capacity-items .hdd .capacity-value', 'HDD')
        .assertIsIntegerContentPositive('.capacity-items .ram .capacity-value', 'RAM')
        .then(() => dashboardPage.discardChanges());
    },
    'Test statistics update'() {
      this.timeout = 120000;
      var controllerNodes = 3;
      var storageCinderNodes = 1;
      var computeNodes = 2;
      var operatingSystemNodes = 1;
      var virtualNodes = 1;
      var valueSelector = '.statistics-block .cluster-info-value';
      var total = controllerNodes + storageCinderNodes + computeNodes + operatingSystemNodes +
        virtualNodes;
      return this.remote
        .then(() => common.addNodesToCluster(controllerNodes, ['Controller']))
        .then(() => common.addNodesToCluster(storageCinderNodes, ['Cinder']))
        .then(() => common.addNodesToCluster(computeNodes, ['Compute']))
        .then(() => common.addNodesToCluster(operatingSystemNodes, ['Operating System'], 'error'))
        .then(() => common.addNodesToCluster(virtualNodes, ['Virtual'], 'offline'))
        .then(() => clusterPage.goToTab('Dashboard'))
        .assertElementTextEquals(
          valueSelector + '.total',
          total,
          'The number of Total nodes in statistics is correct'
        )
        .assertElementTextEquals(
          valueSelector + '.controller',
          controllerNodes,
          'The number of controllerNodes nodes in statistics is correct'
        )
        .assertElementTextEquals(
          valueSelector + '.compute',
          computeNodes,
          'The number of Compute nodes in statistics is correct'
        )
        .assertElementTextEquals(
          valueSelector + '.base-os',
          operatingSystemNodes,
          'The number of Operating Systems nodes in statistics is correct'
        )
        .assertElementTextEquals(
          valueSelector + '.virt',
          virtualNodes,
          'The number of Virtual nodes in statistics is corrects'
        )
        .assertElementTextEquals(
          valueSelector + '.offline',
          1,
          'The number of Offline nodes in statistics is correct'
        )
        .assertElementTextEquals(
          valueSelector + '.error',
          1,
          'The number of Error nodes in statistics is correct'
        )
        .assertElementTextEquals(
          valueSelector + '.pending_addition',
          total,
          'The number of Pending Addition nodes in statistics is correct'
        )
        .clickByCssSelector('.actions-panel .dropdown button.dropdown-toggle')
        .clickByCssSelector('.actions-panel .dropdown .dropdown-menu li.deploy button')
        .then(() => dashboardPage.discardChanges());
    }
  };
});
