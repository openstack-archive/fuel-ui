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
import ClustersPage from 'tests/functional/pages/clusters';
import ClusterPage from 'tests/functional/pages/cluster';
import ModalWindow from 'tests/functional/pages/modal';
import Command from 'intern/dojo/node!leadfoot/Command';
import GenericLib from 'tests/functional/nightly/library/generic';
import EquipmentLib from 'tests/functional/nightly/library/equipment';
import NetworksLib from 'tests/functional/nightly/library/networks';
import DashboardPage from 'tests/functional/pages/dashboard';

registerSuite(() => {
  var common, clustersPage, clusterPage, clusterName, modal, command, genericLib, equipmentLib,
    networksLib, dashboardPage;
  var controllerName = '###EpicBoost###_Node_1';
  var computeName = '###EpicBoost###_Node_2';
  var correlationName = '###EpicBoost###';
  var computeMac = '';
  var computeIp = '';
  var nodesController = 2;
  var nodesCompute = 1;
  var nodesDiscover = 3;
  var nodesError = 1;
  var nodesOffline = 1;
  var nodesCluster = nodesController + nodesCompute;
  var totalNodes = nodesCluster + nodesDiscover + nodesError + nodesOffline;
  var inputArray = [totalNodes, nodesCluster, nodesDiscover, nodesError, nodesOffline];
  var filterArray = [nodesCluster + nodesDiscover, nodesCluster, nodesDiscover, 0, 0];
  var nodeSelector = 'div.node';
  var clusterSelector = nodeSelector + '.pending_addition';
  var toAllNodesSelector = 'input[name="assign_to_all_nodes"]:enabled';
  var summarySelector = 'div.node-summary ';
  var settingsSelector = 'div.node-settings';
  var computeSettingsSelector = clusterSelector + ':nth-child(3) ' + settingsSelector;
  var discoverSettingsSelector = nodeSelector + '.discover ' + settingsSelector;

  return {
    name: 'Nodes across environment',
    setup() {
      common = new Common(this.remote);
      clustersPage = new ClustersPage(this.remote);
      clusterPage = new ClusterPage(this.remote);
      clusterName = common.pickRandomName('VLAN Cluster');
      modal = new ModalWindow(this.remote);
      command = new Command(this.remote);
      genericLib = new GenericLib(this.remote);
      equipmentLib = new EquipmentLib(this.remote);
      networksLib = new NetworksLib(this.remote);
      dashboardPage = new DashboardPage(this.remote);

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName))
        .then(() => common.addNodesToCluster(nodesController, ['Controller']))
        .then(() => common.addNodesToCluster(nodesCompute, ['Compute']))
        .then(() => clusterPage.goToTab('Networks'))
        .then(() => networksLib.gotoNodeNetworkSubTab('Other'))
        .clickByCssSelector(toAllNodesSelector)
        .then(() => networksLib.saveSettings());
    },
    'Node settings pop-up contains environment and node network group names'() {
      var descriptionClusterNode = RegExp(
        'Environment.*' + clusterName + '[\\s\\S]*' +
        'Node network group.*default[\\s\\S]*', 'i');
      var descriptionDiscoveredNode = RegExp(
        '[\\s\\S]*[^(Environment)].*[^(' + clusterName + ')]' +
        '[\\s\\S]*[^(Node network group)].*[^(default)][\\s\\S]*', 'i');
      return this.remote
        .assertElementsExist(toAllNodesSelector + ':checked',
          '"Assign public network to all nodes" option is selected')
        .then(() => genericLib.gotoPage('Equipment'))
        .assertElementsExist('div.nodes-group div.node', '"Equipment" page is not empty')
        // Check correct nodes addiction
        .then(() => equipmentLib.checkNodesSegmentation('standard', inputArray, false))
        .assertElementContainsText(clusterSelector + ':nth-child(1)', 'CONTROLLER',
            '"Controller" node #1 was successfully added to cluster')
        .assertElementContainsText(clusterSelector + ':nth-child(2)', 'CONTROLLER',
            '"Controller" node #2 was successfully added to cluster')
        .assertElementContainsText(clusterSelector + ':nth-child(3)', 'COMPUTE',
            '"Compute" node was successfully added to cluster')
        // Precondition
        .then(() => equipmentLib.renameNode(clusterSelector + ':nth-child(1)', controllerName))
        .then(() => equipmentLib.renameNode(clusterSelector + ':nth-child(3)', computeName))
        // Check "Pending Addition" node
        .assertElementsExist(computeSettingsSelector,
          'Node settings button for Compute node exists')
        .clickByCssSelector(computeSettingsSelector)
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle(computeName))
        .assertElementMatchesRegExp(summarySelector, descriptionClusterNode,
          'Environment name and "default" node network group name are exist and correct')
        // Get IP and MAC for next tests
        .findByCssSelector(summarySelector + '> div:nth-child(2) > div:nth-child(2)')
          .getVisibleText()
          .then((visibleText) => {
            computeMac = visibleText.split(': ')[1];
          })
          .end()
        .findByCssSelector(summarySelector + 'div.management-ip')
          .getVisibleText()
          .then((visibleText) => {
            computeIp = visibleText.split(': ')[1];
          })
          .end()
        .then(() => modal.close())
        // Check clean "Discovered" node
        .clickByCssSelector(discoverSettingsSelector)
        .then(() => modal.waitToOpen())
        .assertElementMatchesRegExp(summarySelector, descriptionDiscoveredNode,
          'Environment name and "default" node network group name are not observed')
        .then(() => modal.close());
    },
    'Check management and public ip fields at unallocated and undeployed node details pop-up'() {
      return this.remote
        // Check "Pending Addition" "Controller" node
        .then(() => equipmentLib.checkGenericIpValues(
          clusterSelector + ':first-child ' + settingsSelector, 'Controller', false))
        // Check "Pending Addition" "Compute" node
        .then(() => equipmentLib.checkGenericIpValues(
          computeSettingsSelector, 'Compute', false))
        // Check "Discovered" node
        .then(() => equipmentLib.checkNoIpValues(discoverSettingsSelector, 'Discovered'))
        // Check "Error" node
        .then(() => equipmentLib.checkNoIpValues(
          nodeSelector + '.error ' + settingsSelector, 'Error'))
        // Check "Offline" node
        .then(() => equipmentLib.checkNoIpValues(
          nodeSelector + '.offline ' + settingsSelector, 'Offline'));
    },
    'Standard and Compact Node view support'() {
      var preSelector = 'input[name="view_mode"][value="';
      var compactSelector = preSelector + 'compact"]';
      var standardSelector = preSelector + 'standard"]';
      return this.remote
        // Check Compact Node view
        .assertElementsExist(compactSelector, '"Compact Node" button is available')
        .findByCssSelector(compactSelector)
          .type('\uE00D')
          .end()
        .then(() => equipmentLib.checkNodesSegmentation('compact', inputArray, false))
        // Check Standard Node view
        .assertElementsExist(standardSelector, '"Standard Node" button is available')
        .findByCssSelector(standardSelector)
          .type('\uE00D')
          .end()
        .then(() => equipmentLib.checkNodesSegmentation('standard', inputArray, false));
    },
    'Quick Search support for "Equipment" page'() {
      var nodeNameSelector = clusterSelector + ' div.name p';
      var btnClearSelector = 'button.btn-clear-search';
      var txtSearchSelector = 'input[name="search"]';
      return this.remote
        .then(() => equipmentLib.activateQuickSearch())
        // Controller search
        .then(() => equipmentLib.checkQuickSearch(nodeSelector, totalNodes, nodeNameSelector,
          controllerName, controllerName))
        // "Empty" search
        .setInputValue(txtSearchSelector, '><+_')
        .sleep(500)
        .assertElementNotExists(nodeSelector, 'No nodes are observed')
        .assertElementMatchesRegExp('div.alert-warning',
          /.*No nodes found matching the selected filters.*/i,
          'Default warning message is observed')
        .clickByCssSelector(btnClearSelector)
        // Compute MAC address search
        .then(() => equipmentLib.checkQuickSearch(nodeSelector, totalNodes, nodeNameSelector,
          computeName, computeMac))
        // Correlation of controller and compute search
        .setInputValue(txtSearchSelector, correlationName)
        .sleep(500)
        .assertElementsExist(nodeSelector, 2, 'Only two nodes with correlation of their names "' +
          correlationName + '" are observed')
        .assertElementTextEquals(clusterSelector + ':first-child div.name p', controllerName,
          'Controller node is searched correctly')
        .assertElementTextEquals(clusterSelector + ':last-child div.name p', computeName,
          'Compute node is searched correctly')
        .clickByCssSelector(btnClearSelector)
        // Compute IP address search
        .then(() => equipmentLib.checkQuickSearch(nodeSelector, totalNodes, nodeNameSelector,
          computeName, computeIp, true));
    },
    'Quick Search results saved after refreshing of page'() {
      return this.remote
        .then(() => command.refresh())
        .then(() => equipmentLib.checkSearchPageSwitching('Equipment', computeName));
    },
    'Quick Search results saved after switching to other page'() {
      return this.remote
        .then(() => equipmentLib.checkSearchPageSwitching('Environments', computeName))
        .then(() => equipmentLib.checkSearchPageSwitching('Releases', computeName))
        .then(() => equipmentLib.checkSearchPageSwitching('Plugins', computeName))
        .then(() => equipmentLib.checkSearchPageSwitching('Support', computeName))
        .clickByCssSelector('button.btn-clear-search');
    },
    'Labels support for "Equipment" page'() {
      var labelName = 'BOOST_LABEL';
      var labelValue = '1.5';
      var btnLabelsSelector = 'button.btn-labels';
      var btnAddLabelSelector = 'button.btn-add-label';
      var btnApplySelector = 'button.btn-success';
      var nameSelector = 'input[label="Name"]';
      var valueSelector = 'input[label="Value"]';
      var labelSelector = nodeSelector + ' div.node-labels button.btn-link';
      var popoverSelector = 'div.popover ';
      var labelPaneSelector = 'div.labels ';
      var labelCheckboxSelector = labelPaneSelector + 'input[type="checkbox"]';
      return this.remote
        .assertElementsExist(nodeSelector + ' input', '"Controller" node exists')
        .clickByCssSelector(nodeSelector + ' input')
        // Add label
        .assertElementEnabled(btnLabelsSelector, '"Manage Labels" button is enabled')
        .clickByCssSelector(btnLabelsSelector)
        .assertElementsAppear(labelPaneSelector, 1000, '"Manage Labels" pane appears')
        .assertElementEnabled(btnAddLabelSelector, '"Add Label" button is enabled')
        .clickByCssSelector(btnAddLabelSelector)
        .assertElementEnabled(nameSelector, '"Name" textfield is enabled')
        .assertElementEnabled(valueSelector, '"Value" textfield is enabled')
        .setInputValue(nameSelector, labelName)
        .setInputValue(valueSelector, labelValue)
        .assertElementEnabled(btnApplySelector, '"Apply" button is enabled')
        .clickByCssSelector(btnApplySelector)
        .assertElementsAppear(labelSelector, 2000, '"Controller" node label appears')
        .clickByCssSelector(labelSelector)
        .assertElementsAppear(popoverSelector, 1000, 'Node label appears')
        .assertElementContainsText(popoverSelector + 'li.label',
          labelName + ' "' + labelValue + '"', 'True label message is observed')
        // Remove label
        .clickByCssSelector(btnLabelsSelector)
        .assertElementsAppear(labelCheckboxSelector, 1000, '"Current label" checkbox appears')
        .clickByCssSelector(labelCheckboxSelector)
        .clickByCssSelector(btnApplySelector)
        .assertElementDisappears(labelSelector, 2000, '"Controller" node label dissappears');
    },
    'Sorting support for "Equipment" page'() {
      return this.remote
        .then(() => equipmentLib.activateSorting())
        .then(() => equipmentLib.checkDefaultSorting('down', inputArray))
        .clickByCssSelector('div.sort-by-status-asc .btn-default')
        .then(() => equipmentLib.checkDefaultSorting('up', inputArray));
    },
    'Filtering support for "Equipment" page'() {
      var statusArray = ['input[name="discover"]', 'input[name="pending_addition"]'];
      return this.remote
        .then(() => equipmentLib.activateFiltering())
        .then(() => equipmentLib.checkNodesSegmentation('standard', inputArray, false))
        .then(() => equipmentLib.setFilterByStatus(statusArray))
        .then(() => equipmentLib.checkSortingPageSwitching('Equipment', filterArray));
    },
    'Sorting and Filtering results saved after refreshing of page'() {
      return this.remote
        .then(() => command.refresh())
        .then(() => equipmentLib.checkSortingPageSwitching('Equipment', filterArray));
    },
    'Sorting and Filtering results saved after switching to other page'() {
      return this.remote
        .then(() => equipmentLib.checkSortingPageSwitching('Environments', filterArray))
        .then(() => equipmentLib.checkSortingPageSwitching('Releases', filterArray))
        .then(() => equipmentLib.checkSortingPageSwitching('Plugins', filterArray))
        .then(() => equipmentLib.checkSortingPageSwitching('Support', filterArray))
        .then(() => equipmentLib.deactivateFiltering());
    },
    'Node groups segmentation on "Equipment" page'() {
      this.timeout = 60000;
      var progressSelector = 'div.dashboard-tab div.progress';
      return this.remote
        // Precondition
        .then(() => genericLib.gotoPage('Environments'))
        .then(() => clustersPage.goToEnvironment(clusterName))
        .then(() => dashboardPage.startDeployment())
        .assertElementsAppear(progressSelector, 5000, 'Deployment is started')
        .assertElementDisappears(progressSelector, 45000, 'Deployment is finished')
        // Check node groups segmentation
        .then(() => genericLib.gotoPage('Equipment'))
        .assertElementNotExists(clusterSelector, '"Pending Addition" node group is gone')
        .then(() => equipmentLib.checkNodesSegmentation('standard', inputArray, true))
        // Check management and public ip fields at node details pop-up
        // Check "Ready" "Controller" node
        .then(() => equipmentLib.checkGenericIpValues(
          nodeSelector + '.ready:first-child ' + settingsSelector, 'Ready Controller', true))
        // Check "Ready" "Compute" node
        .then(() => equipmentLib.checkGenericIpValues(
          nodeSelector + '.ready:last-child ' + settingsSelector, 'Ready Compute', true));
    },
    '"Offline" node deletion from "Equipment" page'() {
      var offlineSelector = nodeSelector + '.offline';
      return this.remote
        .assertElementsExist(offlineSelector, '"Offline" node is observed')
        .assertElementsExist(offlineSelector + ' button.node-remove-button',
          'Remove offline node button exists')
        .clickByCssSelector(offlineSelector + ' button.node-remove-button')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Remove Node'))
        .assertElementsExist('button.btn-danger.btn-delete', 'Remove button exists')
        .clickByCssSelector('button.btn-danger.btn-delete')
        .then(() => modal.waitToClose())
        .then(() => command.refresh())
        .assertElementsAppear('div.equipment-page', 5000, 'Page refreshed successfully')
        .assertElementNotExists(offlineSelector, '"Offline" node is gone');
    }
  };
});
