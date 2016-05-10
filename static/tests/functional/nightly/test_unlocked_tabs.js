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
import DashboardLib from 'tests/functional/nightly/library/dashboard';
import DashboardPage from 'tests/functional/pages/dashboard';
import Modal from 'tests/functional/pages/modal';
import NetworksLib from 'tests/functional/nightly/library/networks';
import 'intern/dojo/node!leadfoot/Command';
import 'intern/dojo/node!leadfoot/Session';
import 'intern/chai!assert';

registerSuite(() => {
  var common,
    clusterPage,
    dashboardPage,
    dashboardLib,
    modal,
    networksLib,
    clusterName;
  var loadDeployedBtn = 'button.btn-load-deployed';
  var cancelChgsBtn = 'button.btn-revert-changes';
  var saveNetworksChangesButton = 'button.btn.apply-btn';
  var saveSettingsChangesButton = 'button.btn-apply-changes';
  var deployButton = '.deploy-btn';
  var clusterStatus = '.cluster-info-value.status';
  return {
    name: 'Unlock "Settings" and "Networks" tabs',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      dashboardPage = new DashboardPage(this.remote);
      dashboardLib = new DashboardLib(this.remote);
      modal = new Modal(this.remote);
      networksLib = new NetworksLib(this.remote);
      clusterName = common.pickRandomName('Test Cluster');

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName))
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => common.addNodesToCluster(1, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'));
    },
    'Check that "load Deployed" button is not shown for cluster in "new" state'() {
      return this.remote
        .assertElementContainsText(clusterStatus, 'New', 'cluster is in "New" state')
        .then(() => clusterPage.goToTab('Networks'))
        .assertElementNotExists(loadDeployedBtn,
          '"Load Deployed Settings" button exists on networks tab')
        .then(() => clusterPage.goToTab('Settings'))
        .assertElementNotExists(loadDeployedBtn,
          '"Load Deployed Settings" button exists on settings tab');
    },
    'Check that any settings are locked till deployment process is in progress'() {
      this.timeout = 45000;
      return this.remote
        .then(() => clusterPage.goToTab('Networks'))
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardPage.startDeployment())
        .then(() => clusterPage.goToTab('Networks'))
        .assertElementExists('div.tab-content div.row.changes-locked',
         '"Networks" tab settings are disabled')
        .then(() => clusterPage.goToTab('Settings'))
        .assertElementExists('div.row.changes-locked', '"Settings" tab attributes are diasabled')
        .then(() => clusterPage.goToTab('Dashboard'))
        .waitForElementDeletion('.progress', 10000);
    },
    'Check "configuration changes warning" behavior in deploying dialog'() {
      this.timeout = 60000;
      var configChangesWarning = 'You have made configuration changes';
      var checkBoxToChange = '.setting-section-public_network_assignment .form-control';
      return this.remote
        // For the first check that warning doesn't appears for non "configuration" changes
        .then(() => common.addNodesToCluster(1, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        .assertElementNotContainsText('.changes-item', 'Changed environment configuration')
        .then(() => dashboardLib.checkWarningNotContainsNote(configChangesWarning))
        .waitForCssSelector('.btn-discard-changes', 1000)
        .then(() => dashboardPage.discardChanges())
        // Now check warning message for "Networking" changes
        .then(() => clusterPage.goToTab('Networks'))
        .clickByCssSelector('.subtab-link-network_settings')
        .waitForCssSelector(checkBoxToChange, 500)
        .clickByCssSelector(checkBoxToChange)
        .waitForCssSelector(saveNetworksChangesButton, 500)
        .clickByCssSelector(saveNetworksChangesButton)
        // wait a bit for updating elements on page
        .waitForCssSelector(checkBoxToChange + '[value="true"]', 1200)
        .assertElementPropertyEquals(checkBoxToChange, 'value', 'true',
         'checkbox "Assign public network to all nodes" has checked')
        .then(() => clusterPage.goToTab('Dashboard'))
        // Check that, after any changes for cluster in operational state,
        // deploy button is available
        .assertElementContainsText(clusterStatus, 'Operational')
        .assertElementExists(deployButton)
        .assertElementContainsText('.changes-item', 'Changed environment configuration')
        .then(() => dashboardLib.checkWarningContainsNote(configChangesWarning))
        .waitForCssSelector('.btn-discard-changes', 1000)
        .then(() => dashboardPage.discardChanges())
        // Verify that changes had discarded
        .waitForElementDeletion('.changes-item', 500)
        .then(() => clusterPage.goToTab('Networks'))
        .clickByCssSelector('.subtab-link-network_settings')
        .waitForCssSelector(checkBoxToChange, 500)
        .assertElementPropertyEquals(checkBoxToChange, 'value', 'false',
          'Networks changes had not discarded')
        // Now check the same with "Settings" changes
        .then(() => clusterPage.goToTab('Settings'))
        .waitForCssSelector('.subtab-link-openstack_services', 500)
        .clickByCssSelector('.subtab-link-openstack_services')
        .waitForCssSelector('input[name="sahara"]', 500)
        .clickByCssSelector('input[name="sahara"]')
        .clickByCssSelector(saveSettingsChangesButton)
        // wait a bit for updating elements on page
        .waitForCssSelector('input[name="sahara"][value=true]', 1200)
        .assertElementPropertyEquals('input[name*="sahara"]', 'value', 'true',
          'checkbox has not enabled')
        .then(() => clusterPage.goToTab('Dashboard'))
        .assertElementContainsText('.changes-item', 'Changed environment configuration')
        .then(() => dashboardLib.checkWarningContainsNote(configChangesWarning))
        // Verify that changes had discarded
        .then(() => dashboardPage.discardChanges())
        .waitForElementDeletion('.changes-item', 500)
        .then(() => clusterPage.goToTab('Settings'))
        .waitForCssSelector('.subtab-link-openstack_services', 500)
        .clickByCssSelector('.subtab-link-openstack_services')
        .waitForCssSelector('input[name="sahara"]', 500)
        .assertElementPropertyEquals('input[name*="sahara"]', 'value', 'false',
          'Settings changes had not discarded');
    },
    'Check "Load deployed settings" button behavior'() {
      this.timeout = 60000;
      var publicVlanChkbox = '.public input[type*="checkbox"][name*="vlan_start"]';
      var publicVlanInput = '.public input[type="text"][name*="vlan_start"]';
      var installIronicChkbox = 'input.form-control[label*="Install Ironic"]';
      return this.remote
        // For the first check button on "Networks" tab
        .then(() => clusterPage.goToTab('Networks'))
        .then(() => networksLib.gotoNodeNetworkSubTab('default'))
        .assertElementEnabled(loadDeployedBtn)
        .waitForCssSelector(cancelChgsBtn, 500)
        .assertElementDisabled(cancelChgsBtn, '"Cancel changes" button should be disabled')
        .assertElementDisabled(saveNetworksChangesButton,
          '"Save changes" button should be disabled')
        .waitForCssSelector(publicVlanChkbox, 500)
        .clickByCssSelector(publicVlanChkbox, 500)
        .waitForCssSelector(publicVlanInput, 500)
        .setInputValue(publicVlanInput, '123')
        .assertElementEnabled(saveNetworksChangesButton, '"Save changes" button should be enabled')
        .clickByCssSelector(saveNetworksChangesButton)
        // wait a bit for updating elements on page
        .waitForCssSelector(publicVlanChkbox + '[value="123"]', 1200)
        .assertElementPropertyEquals(publicVlanChkbox, 'value', '123', 'changes not saved')
        .clickByCssSelector(loadDeployedBtn)
        // click again to maximize stability of test
        .clickByCssSelector(loadDeployedBtn)
        // wait a bit for updating elements on page
        .sleep(2000)
        .waitForCssSelector(publicVlanChkbox, 500)
        .assertElementPropertyEquals(publicVlanChkbox, 'value', '',
          '"Load defaults setting" button does not discard "Networks" changes')
        .then(() => networksLib.saveSettings())
        // Then check button on "Settings" tab
        .then(() => clusterPage.goToTab('Settings'))
        .waitForCssSelector('.subtab-link-openstack_services', 500)
        .clickByCssSelector('.subtab-link-openstack_services')
        .assertElementDisabled(cancelChgsBtn, '"Cancel changes" button should be disabled')
        .assertElementDisabled(saveSettingsChangesButton,
          '"Save changes" button should be disabled')
        .clickByCssSelector(installIronicChkbox)
        .clickByCssSelector(saveSettingsChangesButton)
        // wait a bit for updating elements on page
        .waitForCssSelector(installIronicChkbox + '[value="true"]', 1200)
        .assertElementPropertyEquals(installIronicChkbox, 'value', 'true',
          '"Settings" changes not saved')
        .clickByCssSelector(loadDeployedBtn)
        // wait a bit for updating elements on page
        .waitForCssSelector(installIronicChkbox + '[value="false"]', 1200)
        .assertElementPropertyEquals(installIronicChkbox, 'value', 'false',
          '"Load defaults setting" button does not discard "Settings" changes')
        .clickByCssSelector(saveSettingsChangesButton)
        // Wait for changes apply
        .sleep(1000);
    },
    'Check "deploy changes" button avaialability'() {
      this.timeout = 150000;
      var deploymentMethodToggle = '.dropdown-toggle';
      var chooseProvisionNodesSelector = '.btn-group .dropdown-toggle';
      return this.remote
        // For the first check for cluster in "stopped" state
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => common.addNodesToCluster(1, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardPage.startDeployment())
        // Wait to deploying start
        .sleep(10000)
        .then(() => dashboardPage.stopDeployment())
        // wait a bit for updating status of cluster
        .waitForCssSelector(deployButton, 15000)
        .assertElementContainsText(clusterStatus, 'Stopped',
          'Cluster should be in "Stopped" state')
        .assertElementExists(deployButton, '"Deploy Changes" button exists')
        .assertElementEnabled(deployButton, '"Deploy changes" button is enabled')
        // Then check for cluster in "Partial deployed" state
        .then(() => clusterPage.resetEnvironment(clusterName))
        .waitForCssSelector(deployButton, 10000)
        .clickByCssSelector(deploymentMethodToggle)
        .findByCssSelector('.provision button')
          .then((element) => this.remote.moveMouseTo(element))
          .click()
          .end()
        .waitForCssSelector(chooseProvisionNodesSelector, 500)
        .clickByCssSelector(chooseProvisionNodesSelector)
        .waitForCssSelector('.btn-select-nodes', 500)
        .clickByCssSelector('.btn-select-nodes')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Select Nodes'))
        .waitForCssSelector('.node.selected.pending_addition', 500)
        .clickByCssSelector('.node.selected.pending_addition')
        .then(() => modal.clickFooterButton('Select 2 Nodes'))
        .then(() => modal.waitToClose())
        .waitForCssSelector('.btn-provision', 500)
        .clickByCssSelector('.btn-provision')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Provision Nodes'))
        .then(() => modal.clickFooterButton('Provision 2 Nodes'))
        .waitForElementDeletion('.progress', 20000)
        .waitForCssSelector(deployButton, 10000)
        // Wait a bit while status of the cluster will have updated
        .sleep(2000)
        .assertElementContainsText(clusterStatus, 'Partially Deployed',
          'Cluster should be in "Partially Deployed" status');
        // Then check for cluster in "Errored" state
        // TBD. How to simulate cluster in "Errored" state..?
    }
  };
});
