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
  var saveNetworksChgsBtn = 'button.btn.apply-btn';
  var saveSettingsChgsBtn = 'button.btn-apply-changes';
  var deployBtn = '.deploy-btn';
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
    'Check that "load deployed" button is not shown for cluster in "new" state'() {
      return this.remote
        .assertElementContainsText(clusterStatus, 'New', 'cluster is not "New" state')
        .then(() => clusterPage.goToTab('Networks'))
        .assertElementNotExists(loadDeployedBtn, '"Load defaults" button exists on networks tab')
        .then(() => clusterPage.goToTab('Settings'))
        .assertElementNotExists(loadDeployedBtn, '"Load defaults" button exists on settings tab');
    },
    'Check that any settings are unavailable till deployment process is in progress'() {
      return this.remote
        .then(() => clusterPage.goToTab('Networks'))
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardLib.startDeploying())
        .then(() => clusterPage.goToTab('Networks'))
        .assertElementExists('div.tab-content div.row.changes-locked',
         '"Networks" tab settings is not disabled')
        .then(() => clusterPage.goToTab('Settings'))
        .assertElementExists('div.row.changes-locked', '"Settings" tab attributes is not diasabled')
        .then(() => clusterPage.goToTab('Dashboard'))
        .waitForElementDeletion('.progress', 10000);
    },
    'Check "deploying changes" warning behavior'() {
      this.timeout = 60000;
      var configChangesWarning = 'You have made configuration changes';
      var asgnPblNtwkToAllChkbox = '.setting-section-public_network_assignment .form-control';
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
        .waitForCssSelector(asgnPblNtwkToAllChkbox, 500)
        .clickByCssSelector(asgnPblNtwkToAllChkbox)
        .waitForCssSelector(saveNetworksChgsBtn, 500)
        .clickByCssSelector(saveNetworksChgsBtn)
        // wait a bit for updating elements on page
        .waitForCssSelector(asgnPblNtwkToAllChkbox + '[value="true"]', 1200)
        .assertElementPropertyEquals(asgnPblNtwkToAllChkbox, 'value', 'true',
         'checkbox has not enabled')
        .then(() => clusterPage.goToTab('Dashboard'))
        // Check that, after any changes for claster in operational state, deploy btn has available
        .assertElementContainsText(clusterStatus, 'Operational')
        .assertElementExists(deployBtn)
        .assertElementContainsText('.changes-item', 'Changed environment configuration')
        .then(() => dashboardLib.checkWarningContainsNote(configChangesWarning))
        .waitForCssSelector('.btn-discard-changes', 1000)
        .then(() => dashboardPage.discardChanges())
        // Verify that changes had discarded
        .waitForElementDeletion('.changes-item', 500)
        .then(() => clusterPage.goToTab('Networks'))
        .clickByCssSelector('.subtab-link-network_settings')
        .waitForCssSelector(asgnPblNtwkToAllChkbox, 500)
        .assertElementPropertyEquals(asgnPblNtwkToAllChkbox, 'value', 'false',
          'Networks changes had not discarded')
        // Now check the same with "Settings" changes
        .then(() => clusterPage.goToTab('Settings'))
        .waitForCssSelector('.subtab-link-openstack_services', 500)
        .clickByCssSelector('.subtab-link-openstack_services')
        .waitForCssSelector('input[name="sahara"]', 500)
        .clickByCssSelector('input[name="sahara"]')
        .clickByCssSelector(saveSettingsChgsBtn)
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
        .assertElementDisabled(saveNetworksChgsBtn, '"Save changes" button should be disabled')
        .waitForCssSelector(publicVlanChkbox, 500)
        .clickByCssSelector(publicVlanChkbox, 500)
        .waitForCssSelector(publicVlanInput, 500)
        .setInputValue(publicVlanInput, '123')
        .assertElementEnabled(saveNetworksChgsBtn, '"Save changes" button should be enabled')
        .clickByCssSelector(saveNetworksChgsBtn)
        // wait a bit for updating elements on page
        .waitForCssSelector(publicVlanChkbox + '[value="123"]', 1200)
        .assertElementPropertyEquals(publicVlanChkbox, 'value', '123', 'changes not saved')
        .clickByCssSelector(loadDeployedBtn)
        // wait a bit for updating elements on page
        .sleep(1500)
        .waitForCssSelector(publicVlanChkbox, 500)
        .assertElementPropertyEquals(publicVlanChkbox, 'value', '',
          '"Load defaults setting" button does not discard "Settings" changes')
        .then(() => networksLib.saveSettings())
        // Then check button on "Settings" tab
        .then(() => clusterPage.goToTab('Settings'))
        .waitForCssSelector('.subtab-link-openstack_services', 500)
        .clickByCssSelector('.subtab-link-openstack_services')
        .assertElementDisabled(cancelChgsBtn, '"Cancel changes" button should be disabled')
        .assertElementDisabled(saveSettingsChgsBtn, '"Save changes" button should be disabled')
        .clickByCssSelector(installIronicChkbox)
        .clickByCssSelector(saveSettingsChgsBtn)
        // wait a bit for updating elements on page
        .waitForCssSelector(installIronicChkbox + '[value="true"]', 1200)
        .assertElementPropertyEquals(installIronicChkbox, 'value', 'true',
          '"Settings" changes not saved')
        .clickByCssSelector(loadDeployedBtn)
        // wait a bit for updating elements on page
        .waitForCssSelector(installIronicChkbox + '[value="false"]', 1200)
        .assertElementPropertyEquals(installIronicChkbox, 'value', 'false',
          '"Load defaults setting" button does not discard "Settings" changes')
        .clickByCssSelector(saveSettingsChgsBtn)
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
        .then(() => dashboardLib.startDeploying())
        // Wait to deploying start
        .sleep(10000)
        .then(() => dashboardLib.stopDeploying())
        // wait a bit for updating status of cluster
        .waitForCssSelector(deployBtn, 15000)
        .assertElementContainsText(clusterStatus, 'Stopped',
          'Cluster should be in "Stopped" state')
        .assertElementExists(deployBtn, '"Deploy Changes" button exists')
        .assertElementEnabled(deployBtn, '"Deploy changes" button is enabled')
        // Then check for cluster in "Partial deployed" state
        .then(() => clusterPage.resetEnvironment(clusterName))
        .waitForCssSelector(deployBtn, 10000)
        .clickByCssSelector(deploymentMethodToggle)
        .findByCssSelector(deploymentMethodToggle + ' .provision button')
          .then((element) => this.remote.moveMouseTo(element))
          .click()
          .end()
        .waitForCssSelector(chooseProvisionNodesSelector, 500)
        .clickByCssSelector(chooseProvisionNodesSelector)
        .clickByCssSelector(chooseProvisionNodesSelector + ' .btn-select-nodes')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Select Nodes'))
        .clickByCssSelector('.node.selected.pending_addition')
        .then(() => modal.clickFooterButton('Select 1 Node'))
        .then(() => modal.waitToClose())
        .clickByCssSelector('.btn-provision')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Provision Nodes'))
        .then(() => modal.clickFooterButton('Provision 1 Node'))
        .waitForElementDeletion('.progress', 12000)
        .waitForCssSelector(deployBtn, 3000)
        .assertElementContainsText(clusterStatus, 'Partially Deployed',
          'Claster should be in "Partially Deployed" status');
        // Then check for cluster in "Errored" state
        // TBD how to simulate cluster in "Errored" state..?
    }
  };
});
