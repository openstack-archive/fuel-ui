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
import NetworksLib from 'tests/functional/nightly/library/networks';
import SettingsLib from 'tests/functional/nightly/library/settings';
import EquipmentLib from 'tests/functional/nightly/library/equipment';

registerSuite(() => {
  var common,
    clusterPage,
    clusterName,
    networksLib,
    settingsLib,
    equipmentLib;
  var networkName = 'Baremetal';
  var baremetalSelector = 'div.' + networkName.toLowerCase() + ' ';
  var ipRangesSelector = baremetalSelector + 'div.ip_ranges ';
  var cidrSelector = baremetalSelector + 'div.cidr input[type="text"]';
  var vlanSelector = baremetalSelector + 'div.vlan_start input[type="text"]';
  var vlanErrorSelector = baremetalSelector + 'div.vlan_start div.has-error span[class^="help"]';
  var errorSelector = baremetalSelector + 'div.has-error ';
  var startIpSelector = ipRangesSelector + 'input[name*="range-start"] ';
  var endIpSelector = ipRangesSelector + 'input[name*="range-end"] ';

  return {
    name: 'GUI support for Ironic',
    setup() {
      // Create cluster with additional service "Ironic"
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      networksLib = new NetworksLib(this.remote);
      settingsLib = new SettingsLib(this.remote);
      equipmentLib = new EquipmentLib(this.remote);
      clusterName = common.pickRandomName('Ironic Cluster');

      return this.remote
        // Enabling Ironic when creating environment
        .then(common.getIn)
        .then(
          () => common.createCluster(
            clusterName,
            {
              'Storage Backends'() {
                return this.remote
                  .clickByCssSelector('input[value$="block:ceph"]');
              },
              'Additional Services'() {
                return this.remote
                  .clickByCssSelector('input[value$="ironic"]');
              }
            }
          )
        );
    },
    'Check Ironic item on Settings tab'() {
      var ironicSelector = 'input[name=ironic]:enabled:checked';
      return this.remote
        // Check Ironic item on Settings tab
        .then(() => clusterPage.goToTab('Settings'))
        .then(() => settingsLib.gotoOpenStackSettings('OpenStack Services'))
        .assertElementsExist(ironicSelector, 'Ironic checkbox is enabled and selected')
        // Check "Baremetal Network" initial state
        .then(() => clusterPage.goToTab('Networks'))
        .then(() => networksLib.checkNetworkInitialState(networkName));
    },
    'Baremetal Network "IP Ranges" correct changing'() {
      var correctIpRange = ['192.168.3.15', '192.168.3.100'];
      return this.remote
        // Change network settings
        .setInputValue(startIpSelector, correctIpRange[0])
        .setInputValue(endIpSelector, correctIpRange[1])
        .assertElementNotExists(errorSelector, 'No Baremetal errors are observed')
        .then(networksLib.saveSettings);
    },
    'Baremetal Network "IP Ranges" adding and deleting additional fields'() {
      var correctIpRange = ['192.168.3.1', '192.168.3.50'];
      var newIpRange = ['192.168.3.55', '192.168.3.70'];
      return this.remote
        // Change network settings
        .setInputValue(startIpSelector, correctIpRange[0])
        .setInputValue(endIpSelector, correctIpRange[1])
        // Add new IP range
        .then(() => networksLib.addNewIpRange(networkName, newIpRange))
        .then(networksLib.saveSettings)
        // Remove just added IP range
        .then(() => networksLib.deleteIpRange(networkName))
        .then(networksLib.saveSettings);
    },
    'Baremetal and other networks intersections'() {
      this.timeout = 45000;
      // [Baremetal CIDR, Baremetal Start IP, Baremetal End IP, Ironic Start IP,
      // Ironic End IP, Ironic Gateway]
      var storageValues = ['192.168.1.0/24', '192.168.1.1', '192.168.1.50', '192.168.1.52',
        '192.168.1.254', '192.168.1.51'];
      var managementValues = ['192.168.0.0/24', '192.168.0.1', '192.168.0.50', '192.168.0.52',
        '192.168.0.254', '192.168.0.51'];
      var publicValues = ['172.16.0.0/24', '172.16.0.1', '172.16.0.50', '172.16.0.51',
        '172.16.0.254', '172.16.0.52'];
      return this.remote
        .then(() => networksLib.checkBaremetalIntersection('storage', storageValues))
        .then(() => networksLib.checkBaremetalIntersection('management', managementValues))
        .then(() => networksLib.checkBaremetalIntersection('public', publicValues));
    },
    'Baremetal Network "Use VLAN tagging" option works'() {
      var chboxVlanSelector = baremetalSelector + 'div.vlan_start input[type="checkbox"]';
      var vlanTag = '104';
      return this.remote
        // Unselect "Use VLAN tagging" option
        .clickByCssSelector(chboxVlanSelector)
        .assertElementNotSelected(chboxVlanSelector + ':enabled',
          'Baremetal "Use VLAN tagging" checkbox is enabled and not selected')
        .assertElementNotExists(vlanSelector,
          'Baremetal "Use VLAN tagging" textfield does not exist')
        .assertElementNotExists(errorSelector, 'No Baremetal errors are observed')
        .then(networksLib.saveSettings)
        // Select back "Use VLAN tagging" option
        .clickByCssSelector(chboxVlanSelector)
        .assertElementsExist(chboxVlanSelector + ':enabled:checked',
          'Baremetal "Use VLAN tagging" checkbox is enabled and selected')
        .assertElementEnabled(vlanSelector,
          'Baremetal "Use VLAN tagging" textfield is enabled')
        .assertElementContainsText(vlanErrorSelector,
          'Invalid VLAN ID', 'True error message is displayed')
        .setInputValue(vlanSelector, vlanTag)
        .assertElementNotExists(errorSelector, 'No Baremetal errors are observed')
        .then(networksLib.saveSettings);
    },
    'Baremetal Network "Use VLAN tagging" option validation'() {
      var btnSaveSelector = 'button.apply-btn';
      var vlanTag = ['0', '10000', '4095', '', '1', '4094'];
      var errorMessage = 'Invalid VLAN ID';
      return this.remote
        // Check "Use VLAN tagging" text field
        .then(
          () => networksLib.checkIncorrectValueInput(
            vlanSelector, vlanTag[0], vlanErrorSelector, errorMessage
          )
        )
        .then(
          () => networksLib.checkIncorrectValueInput(
            vlanSelector, vlanTag[1], vlanErrorSelector, errorMessage
          )
        )
        .then(
          () => networksLib.checkIncorrectValueInput(
            vlanSelector, vlanTag[2], vlanErrorSelector, errorMessage
          )
        )
        .then(
          () => networksLib.checkIncorrectValueInput(
            vlanSelector, vlanTag[3], vlanErrorSelector, errorMessage
          )
        )
        .setInputValue(vlanSelector, vlanTag[4])
        .assertElementNotExists(errorSelector, 'No Baremetal errors are observed')
        .assertElementEnabled(btnSaveSelector, 'Save Settings button is enabled')
        .setInputValue(vlanSelector, vlanTag[5])
        .assertElementNotExists(errorSelector, 'No Baremetal errors are observed')
        .assertElementEnabled(btnSaveSelector, 'Save Settings button is enabled')
        // Cancel changes
        .then(networksLib.cancelChanges)
        .then(() => networksLib.checkNetworkInitialState(networkName));
    },
    'Baremetal Network "CIDR" field validation'() {
      var cidrErrorSelector = baremetalSelector + 'div.cidr div.has-error span[class^="help"]';
      var l3Selector = 'a[class$="neutron_l3"] ';
      var cidrPart1 = '192.168.3.0/';
      var cidrPart2 = ['245', '0', '1', '31', '33', '25'];
      var errorMessage = 'Invalid CIDR';
      return this.remote
        // Check "CIDR" text field
        .then(
          () => networksLib.checkIncorrectValueInput(
            cidrSelector, cidrPart1 + cidrPart2[0], cidrErrorSelector, errorMessage
          )
        )
        .then(
          () => networksLib.checkIncorrectValueInput(
            cidrSelector, cidrPart1 + cidrPart2[1], cidrErrorSelector, errorMessage
          )
        )
        .then(
          () => networksLib.checkIncorrectValueInput(
            cidrSelector, cidrPart1 + cidrPart2[2], cidrErrorSelector, 'Network is too large'
          )
        )
        .then(
          () => networksLib.checkIncorrectValueInput(
            cidrSelector, cidrPart1 + cidrPart2[3], cidrErrorSelector, 'Network is too small'
          )
        )
        .then(
          () => networksLib.checkIncorrectValueInput(
            cidrSelector, cidrPart1 + cidrPart2[4], cidrErrorSelector, errorMessage
          )
        )
        .setInputValue(cidrSelector, cidrPart1 + cidrPart2[5])
        .assertElementExists(l3Selector, '"Neutron L3" link exists')
        .assertElementExists(l3Selector + 'i.glyphicon-danger-sign',
          'Error icon is observed before Neutron L3 link')
        .clickByCssSelector(l3Selector)
        .assertElementExists('div.has-error input[name="range-end_baremetal_range"]',
          '"Ironic IP range" End textfield is "red" marked')
        .assertElementContainsText('div.form-baremetal-network div.validation-error ' +
          'span[class^="help"]', 'IP address does not match the network CIDR',
          'True error message is displayed')
        .then(networksLib.checkMultirackVerification)
        // Cancel changes
        .then(networksLib.cancelChanges)
        .then(() => networksLib.checkNetworkInitialState(networkName));
    },
    'Baremetal Network "Use the whole CIDR" option works'() {
      return this.remote
        .then(() => networksLib.checkCidrOption(networkName))
        .then(networksLib.saveSettings);
    },
    'Combinations ironic role with other roles validation'() {
      var nodesAmount = 1;
      var addNodeButtonSelector = '.btn-add-nodes';
      var applyButtonSelector = 'button.btn-apply';
      var selectedIronicRoleSelector = '.role-block.ironic i.glyphicon-selected-role';
      return this.remote
        .then(() => clusterPage.goToTab('Nodes'))
        .clickByCssSelector(addNodeButtonSelector)
        .waitForElementDeletion(addNodeButtonSelector, 3000)
        .assertElementsAppear('.node', 3000, 'Unallocated nodes loaded')
        .assertElementExists('.role-block.ironic:not(.disabled)', 'Ironic role is unlocked')
        // Select node
        .then(() => clusterPage.checkNodes(nodesAmount))
        .then(() => clusterPage.checkNodeRoles(['Ironic']))
        .assertElementExists(selectedIronicRoleSelector,
          'Selected role has checkbox icon')
        .assertElementExists('.role-block.compute.disabled',
          'Compute role can not be added together with selected roles')
        .assertElementEnabled(applyButtonSelector,
          'Apply button is enabled')
        .then(equipmentLib.uncheckNodeRoles)
        // Check Ironic + Compute roles are available
        .then(() => clusterPage.checkNodeRoles(['Ironic', 'Controller']))
        .assertElementExists(selectedIronicRoleSelector,
          'Selected role has checkbox icon')
        .assertElementExists('.role-block.controller i.glyphicon-selected-role',
          'Selected role has checkbox icon')
        .assertElementEnabled(applyButtonSelector,
          'Apply button is enabled')
        .then(equipmentLib.uncheckNodeRoles)
        // Check Ironic + Ceph roles are available
        .then(() => clusterPage.checkNodeRoles(['Ironic', 'Ceph OSD']))
        .assertElementExists(selectedIronicRoleSelector,
          'Selected role has checkbox icon')
        .assertElementExists('.role-block.ceph-osd i.glyphicon-selected-role',
          'Selected role has checkbox icon')
        .assertElementEnabled(applyButtonSelector,
          'Apply button is enabled')
        .then(equipmentLib.uncheckNodeRoles);
    },
    'Disabling ironic service'() {
      var addNodeButtonSelector = '.btn-add-nodes';
      return this.remote
        .then(() => clusterPage.goToTab('Settings'))
        .then(() => settingsLib.gotoOpenStackSettings('OpenStack Services'))
        .clickByCssSelector('input[name=ironic]')
        .waitForCssSelector('.btn-apply-changes:not(:disabled)', 200)
        .clickByCssSelector('.btn-apply-changes')
        .waitForCssSelector('.btn-load-defaults:not(:disabled)', 1000)
        // Check that ironic disabled
        .then(() => clusterPage.goToTab('Nodes'))
        .clickByCssSelector(addNodeButtonSelector)
        .waitForElementDeletion(addNodeButtonSelector, 3000)
        .assertElementsAppear('.node', 3000, 'Unallocated nodes loaded')
        .assertElementExists('.role-block.ironic.disabled',
          'Ironic role is unlocked');
    }
  };
});
