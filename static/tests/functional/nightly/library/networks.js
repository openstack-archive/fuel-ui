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

import ModalWindow from 'tests/functional/pages/modal';
import 'tests/functional/helpers';

function NetworksLib(remote) {
  this.remote = remote;
  this.modal = new ModalWindow(remote);
}

NetworksLib.prototype = {
  constructor: NetworksLib,
  btnSaveSelector: 'button.apply-btn',
  btnCancelSelector: 'button.btn-revert-changes',
  btnVerifySelector: 'button.verify-networks-btn',
  allNetSelector: 'input.show-all-networks',
  netGroupListSelector: 'ul.node_network_groups ',
  netGroupNameSelector: 'div.network-group-name ',
  defaultPlaceholder: '127.0.0.1',

  gotoNodeNetworkSubTab(groupName) {
    var networkSubtabSelector = 'div[id="network-subtabs"]';
    return this.remote
      .assertElementAppears(networkSubtabSelector, 1000, 'Network subtab list exists')
      .assertElementContainsText(networkSubtabSelector, groupName,
        '"' + groupName + '" link exists')
      .findByCssSelector(networkSubtabSelector)
        .clickLinkByText(groupName)
        .sleep(500)
        .assertElementContainsText('li.active', groupName, '"' + groupName + '" link is opened')
        .end();
  },
  checkNetworkInitialState(networkName) {
    var mainDiv = 'div.col-xs-10 div:first-child div.' + networkName.toLowerCase() + ' ';
    var properNames = ['Public', 'Storage', 'Management', 'Baremetal', 'Private'];
    var chain = this.remote;
    if (properNames.indexOf(networkName) === -1) {
      throw new Error('Invalid input value. Check networkName: "' + networkName +
        '" parameter and restart test.');
    }
    // Generic components
    chain = chain.assertElementDisabled(this.btnSaveSelector, '"Save Settings" button is disabled')
    .assertElementDisabled(this.btnCancelSelector, '"Cancel Changes" button is disabled')
    .assertElementNotExists('div.has-error', 'No Network errors are observed')
    // CIDR
    .assertElementEnabled(mainDiv + 'div.cidr input[type="text"]',
      networkName + ' "CIDR" textfield is enabled')
    .assertElementEnabled(mainDiv + 'div.cidr input[type="checkbox"]',
      networkName + ' "Use the whole CIDR" checkbox is enabled')
    // IP Ranges
    .assertElementsExist(mainDiv + 'div.ip_ranges div.range-row', 1,
      'Only default IP range is observed for ' + networkName + ' network')
    // VLAN
    .assertElementEnabled(mainDiv + 'div.vlan_start input[type="checkbox"]',
      networkName + ' "Use VLAN tagging" checkbox is enabled');

    // Individual components
    if (networkName === 'Public' || networkName === 'Baremetal') {
      // CIDR
      chain = chain.assertElementNotSelected(mainDiv + 'div.cidr input[type="checkbox"]',
        networkName + ' "Use the whole CIDR" checkbox is not selected')
      // IP Ranges
      .assertElementEnabled(mainDiv + 'div.ip_ranges input[name*="range-start"]',
        networkName + ' "Start IP Range" textfield is enabled')
      .assertElementEnabled(mainDiv + 'div.ip_ranges input[name*="range-end"]',
        networkName + ' "End IP Range" textfield is enabled')
      .assertElementEnabled(mainDiv + 'div.ip_ranges button.ip-ranges-add',
        networkName + ' "Add new IP range" button is enabled');
      if (networkName === 'Public') {
        // CIDR
        chain = chain.assertElementPropertyEquals(mainDiv + 'div.cidr input[type="text"]',
          'value', '172.16.0.0/24', networkName + ' "CIDR" textfield has default value')
        // IP Ranges
        .assertElementPropertyEquals(mainDiv + 'div.ip_ranges input[name*="range-start"]',
          'value', '172.16.0.2', networkName + ' "Start IP Range" textfield  has default value')
        .assertElementPropertyEquals(mainDiv + 'div.ip_ranges input[name*="range-end"]',
          'value', '172.16.0.126', networkName + ' "End IP Range" textfield has default value')
        // Gateway
        .assertElementEnabled(mainDiv + 'input[name="gateway"][type="text"]',
          networkName + ' "Gateway" textfield is enabled')
        .assertElementPropertyEquals(mainDiv + 'input[name="gateway"][type="text"]',
          'value', '172.16.0.1', networkName + ' "Gateway" textfield  has default value')
        // VLAN
        .assertElementNotSelected(mainDiv + 'div.vlan_start input[type="checkbox"]',
          networkName + ' "Use VLAN tagging" checkbox is not selected')
        .assertElementNotExists(mainDiv + 'div.vlan_start input[type="text"]',
          networkName + ' "Use VLAN tagging" textfield is not exist');
      } else if (networkName === 'Baremetal') {
        // CIDR
        chain = chain.assertElementPropertyEquals(mainDiv + 'div.cidr input[type="text"]',
          'value', '192.168.3.0/24', networkName + ' "CIDR" textfield has default value')
        // IP Ranges
        .assertElementPropertyEquals(mainDiv + 'div.ip_ranges input[name*="range-start"]',
          'value', '192.168.3.2', networkName + ' "Start IP Range" textfield  has default value')
        .assertElementPropertyEquals(mainDiv + 'div.ip_ranges input[name*="range-end"]',
          'value', '192.168.3.50', networkName + ' "End IP Range" textfield has default value')
        // VLAN
        .assertElementSelected(mainDiv + 'div.vlan_start input[type="checkbox"]',
          networkName + ' "Use VLAN tagging" checkbox is selected')
        .assertElementEnabled(mainDiv + 'div.vlan_start input[type="text"]',
          networkName + ' "Use VLAN tagging" textfield is enabled')
        .assertElementPropertyEquals(mainDiv + 'div.vlan_start input[type="text"]', 'value',
          '104', networkName + ' "Use VLAN tagging" textfield has default value');
      }
    } else {
      // CIDR
      chain = chain.assertElementSelected(mainDiv + 'div.cidr input[type="checkbox"]',
        'Baremetal "Use the whole CIDR" checkbox is selected')
      // IP Ranges
      .assertElementDisabled(mainDiv + 'div.ip_ranges input[name*="range-start"]',
        networkName + ' "Start IP Range" textfield is disabled')
      .assertElementDisabled(mainDiv + 'div.ip_ranges input[name*="range-end"]',
        networkName + ' "End IP Range" textfield is disabled')
      .assertElementDisabled(mainDiv + 'div.ip_ranges button.ip-ranges-add',
        networkName + ' "Add new IP range" button is disabled')
      // VLAN
      .assertElementSelected(mainDiv + 'div.vlan_start input[type="checkbox"]',
        networkName + ' "Use VLAN tagging" checkbox is selected')
      .assertElementEnabled(mainDiv + 'div.vlan_start input[type="text"]',
        networkName + ' "Use VLAN tagging" textfield is enabled');
      if (networkName === 'Storage') {
        // CIDR
        chain = chain.assertElementPropertyEquals(mainDiv + 'div.cidr input[type="text"]',
          'value', '192.168.1.0/24', networkName + ' "CIDR" textfield has default value')
        // IP Ranges
        .assertElementPropertyEquals(mainDiv + 'div.ip_ranges input[name*="range-start"]',
          'value', '192.168.1.1', networkName + ' "Start IP Range" textfield  has default value')
        .catch(() => this.remote.assertElementPropertyEquals(
          mainDiv + 'div.ip_ranges input[name*="range-start"]', 'value', '192.168.1.2',
          networkName + ' "Start IP Range" textfield  has default value'))
        .assertElementPropertyEquals(mainDiv + 'div.ip_ranges input[name*="range-end"]',
          'value', '192.168.1.254', networkName + ' "End IP Range" textfield has default value')
        // VLAN
        .assertElementPropertyEquals(mainDiv + 'div.vlan_start input[type="text"]', 'value',
          '102', networkName + ' "Use VLAN tagging" textfield has default value');
      } else if (networkName === 'Management') {
        // CIDR
        chain = chain.assertElementPropertyEquals(mainDiv + 'div.cidr input[type="text"]',
          'value', '192.168.0.0/24', networkName + ' "CIDR" textfield has default value')
        // IP Ranges
        .assertElementPropertyEquals(mainDiv + 'div.ip_ranges input[name*="range-start"]',
          'value', '192.168.0.1', networkName + ' "Start IP Range" textfield  has default value')
        .catch(() => this.remote.assertElementPropertyEquals(
          mainDiv + 'div.ip_ranges input[name*="range-start"]', 'value', '192.168.0.2',
          networkName + ' "Start IP Range" textfield  has default value'))
        .assertElementPropertyEquals(mainDiv + 'div.ip_ranges input[name*="range-end"]',
          'value', '192.168.0.254', networkName + ' "End IP Range" textfield has default value')
        // VLAN
        .assertElementPropertyEquals(mainDiv + 'div.vlan_start input[type="text"]', 'value',
          '101', networkName + ' "Use VLAN tagging" textfield has default value');
      } else if (networkName === 'Private') {
        // CIDR
        chain = chain.assertElementPropertyEquals(mainDiv + 'div.cidr input[type="text"]',
          'value', '192.168.2.0/24', networkName + ' "CIDR" textfield has default value')
        // IP Ranges
        .assertElementPropertyEquals(mainDiv + 'div.ip_ranges input[name*="range-start"]',
          'value', '192.168.2.1', networkName + ' "Start IP Range" textfield  has default value')
        .assertElementPropertyEquals(mainDiv + 'div.ip_ranges input[name*="range-end"]',
          'value', '192.168.2.254', networkName + ' "End IP Range" textfield has default value')
        // VLAN
        .assertElementPropertyEquals(mainDiv + 'div.vlan_start input[type="text"]', 'value',
          '103', networkName + ' "Use VLAN tagging" textfield has default value');
      }
    }
    return chain;
  },
  checkNetrworkSettingsSegment(neutronType) {
    var chain = this.remote;
    // Check Neutron L2 subtab
    chain = chain.clickByCssSelector('.subtab-link-neutron_l2')
    .assertElementExists('li.active a.subtab-link-neutron_l2', '"Neutron L2" subtab is selected')
    .assertElementTextEquals('h3.networks', 'Neutron L2 Configuration',
      '"Neutron L2" subtab is opened');
    if (neutronType === 'VLAN') {
      chain = chain.assertElementContainsText('div.network-description',
        'Neutron supports different types of network segmentation such as VLAN, GRE, VXLAN ' +
        'etc. This section is specific to VLAN segmentation related parameters such as VLAN ID ' +
        'ranges for tenant separation and the Base MAC address',
        '"Neutron L2" description is correct')
      .assertElementEnabled('input[name="range-start_vlan_range"]',
        '"VLAN ID range" start textfield enabled')
      .assertElementEnabled('input[name="range-end_vlan_range"]',
        '"VLAN ID range" end textfield enabled');
    } else {
      chain = chain.assertElementContainsText('div.network-description',
        'Neutron supports different types of network segmentation such as VLAN, GRE, VXLAN ' +
        'etc. This section is specific to a tunneling segmentation related parameters such as ' +
        'Tunnel ID ranges for tenant separation and the Base MAC address',
        '"Neutron L2" description is correct')
      .assertElementEnabled('input[name="range-start_gre_id_range"]',
        '"Tunnel ID range" start textfield enabled')
      .assertElementEnabled('input[name="range-end_gre_id_range"]',
        '"Tunnel ID range" end textfield enabled');
    }
    chain = chain.assertElementEnabled('input[name="base_mac"]',
      '"Base MAC address" textfield enabled')
    // Check Neutron L3 subtab
    .clickByCssSelector('.subtab-link-neutron_l3')
    .assertElementExists('li.active a.subtab-link-neutron_l3', '"Neutron L3" subtab is selected')
    .findByCssSelector('div.form-floating-network')
      .assertElementTextEquals('h3', 'Floating Network Parameters',
        'Default subgroup name is observed')
      .assertElementContainsText('div.network-description',
        'This network is used to assign Floating IPs to tenant VMs',
        'Default subgroup description is observed')
      .assertElementEnabled('input[name^="range-start"]',
        '"Floating IP range" start textfield enabled')
      .assertElementEnabled('input[name^="range-end"]',
        '"Floating IP range" end textfield enabled')
      .assertElementEnabled('input[name="floating_name"]',
        '"Floating network name" textfield enabled')
      .end()
    .findByCssSelector('div.form-internal-network')
      .assertElementTextEquals('h3', 'Admin Tenant Network Parameters',
        'Default subgroup name is observed')
      .assertElementContainsText('div.network-description',
        'This Admin Tenant network provides internal network access for instances. It can be ' +
        'used only by the Admin tenant.', 'Default subgroup description is observed')
      .assertElementEnabled('input[name="internal_cidr"]',
        '"Admin Tenant network CIDR" textfield enabled')
      .assertElementEnabled('input[name="internal_gateway"]',
        '"Admin Tenant network gateway" textfield enabled')
      .assertElementEnabled('input[name="internal_name"]',
        '"Admin Tenant network name" textfield enabled')
      .end()
    .findByCssSelector('div.form-dns-nameservers')
      .assertElementTextEquals('h3', 'Guest OS DNS Servers', 'Default subgroup name is observed')
      .assertElementContainsText('div.network-description', 'This setting is used to specify ' +
        'the upstream name servers for the environment. These servers will be used to forward ' +
        'DNS queries for external DNS names to DNS servers outside the environment',
        'Default subgroup description is observed')
      .assertElementsExist('input[name=dns_nameservers]', 2,
        '"Guest OS DNS Servers" both textfields are exists')
      .end()
    // Check Other subtab
    .clickByCssSelector('.subtab-link-network_settings')
    .assertElementExists('li.active a.subtab-link-network_settings', '"Other" subtab is selected')
    .assertElementTextEquals('span.subtab-group-public_network_assignment',
      'Public network assignment', 'Default subgroup name is observed')
    .assertElementEnabled('input[name="assign_to_all_nodes"]',
      '"Assign public network to all nodes" checkbox enabled')
    .assertElementTextEquals('span.subtab-group-neutron_advanced_configuration',
      'Neutron Advanced Configuration', 'Default subgroup name is observed')
    .assertElementEnabled('input[name="neutron_l3_ha"]', '"Neutron L3 HA" checkbox enabled');
    if (neutronType === 'VLAN') {
      chain = chain.assertElementEnabled('input[name="neutron_dvr"]',
        '"Neutron DVR" checkbox enabled');
    } else {
      chain = chain.assertElementDisabled('input[name="neutron_dvr"]',
        '"Neutron DVR" checkbox disabled')
      .assertElementEnabled('input[name="neutron_l2_pop"]',
        '"Neutron L2 population" checkbox enabled');
    }
    chain = chain.assertElementTextEquals('span.subtab-group-external_dns', 'Host OS DNS Servers',
      'Default subgroup name is observed')
    .assertElementEnabled('input[name="dns_list"]', '"DNS list" textfield enabled')
    .assertElementTextEquals('span.subtab-group-external_ntp', 'Host OS NTP Servers',
      'Default subgroup name is observed')
    .assertElementEnabled('input[name="ntp_list"]', '"NTP server list" textfield enabled');
    return chain;
  },
  checkNetrworkVerificationSegment() {
    var connectSelector = 'div.connect-';
    var verifyNodeSelector = 'div.verification-node-';
    var descriptionConnectivityCheck = RegExp(
      'Network verification checks the following[\\s\\S]*' +
      'L2 connectivity checks between nodes in the environment[\\s\\S]*' +
      'DHCP discover check on all nodes[\\s\\S]*' +
      'Repository connectivity check from the Fuel Master node[\\s\\S]*' +
      'Repository connectivity check from the Fuel Slave nodes through the public & ' +
      'admin.*PXE.*networks[\\s\\S]*', 'i');
    return this.remote
      .clickByCssSelector('.subtab-link-network_verification')
      .assertElementExists('li.active .subtab-link-network_verification',
        '"Connectivity Check" subtab is selected')
      .assertElementTextEquals('h3', 'Connectivity Check',
        '"Connectivity Check" subtab is opened')
      // Check default picture router scheme
      .findByCssSelector('div.verification-network-placeholder')
        .assertElementExists('div.verification-router', 'Main router picture is observed')
        .assertElementExists(connectSelector + '1',
          'Connection line picture for "left" node #1 is observed')
        .assertElementExists(connectSelector + '2',
          'Connection line picture for "center" node #2 is observed')
        .assertElementExists(connectSelector + '3',
          'Connection line picture for "right" node #3 is observed')
        .assertElementExists(verifyNodeSelector + '1', '"Left" node #1 picture is observed')
        .assertElementExists(verifyNodeSelector + '2', '"Center" node #2 picture is observed')
        .assertElementExists(verifyNodeSelector + '3', '"Right" node #3 picture is observed')
        .end()
      // Check default verification description
      .assertElementExists('ol.verification-description',
        '"Connectivity check" description is observed')
      .assertElementMatchesRegExp('ol.verification-description', descriptionConnectivityCheck,
        'Default "Connectivity check" description is observed')
      .assertElementExists(this.btnVerifySelector, '"Verify Networks" is disabled')
      .assertElementExists(this.btnCancelSelector, '"Cancel Changes" button is disabled')
      .assertElementExists(this.btnSaveSelector, '"Save Settings" button is disabled');
  },
  checkNetrworkIpRanges(networkName, correctIpRange, newIpRange) {
    var netSelector = 'div.' + networkName.toLowerCase() + ' ';
    var ipStartSelector = netSelector + 'div.ip_ranges input[name*="range-start"]';
    var ipEndSelector = netSelector + 'div.ip_ranges input[name*="range-end"]';
    var properNames = ['Public', 'Storage', 'Management', 'Baremetal', 'Private'];
    if (properNames.indexOf(networkName) === -1) {
      throw new Error('Invalid input value. Check networkName: "' + networkName +
        '" parameter and restart test.');
    }
    return this.remote
      // "Use the whole CIDR" option works
      .then(() => this.checkCidrOption(networkName))
      .then(() => this.saveSettings())
      // Correct changing of "IP Ranges" works
      .setInputValue(ipStartSelector, correctIpRange[0])
      .setInputValue(ipEndSelector, correctIpRange[1])
      .then(() => this.saveSettings())
      .assertElementPropertyEquals(ipStartSelector, 'value', correctIpRange[0],
        networkName + ' "Start IP Range" textfield  has correct new value')
      .assertElementPropertyEquals(ipEndSelector, 'value', correctIpRange[1],
        networkName + ' "End IP Range" textfield has correct new value')
      // Adding and deleting additional "IP Ranges" fields
      .then(() => this.addNewIpRange(networkName, newIpRange))
      .then(() => this.saveSettings())
      .then(() => this.deleteIpRange(networkName))
      .then(() => this.saveSettings())
      // Check "IP Ranges" Start and End validation
      .then(() => this.checkIpRanges(networkName));
  },
  checkIncorrectValueInput(inputSelector, value, errorSelector, errorMessage) {
    return this.remote
      .assertElementEnabled(inputSelector, '"' + inputSelector + '" is enabled')
      .setInputValue(inputSelector, value)
      .assertElementAppears(errorSelector, 1000,
        'Error message appears for "' + inputSelector + '" with "' + value + '" value')
      .assertElementContainsText(errorSelector, errorMessage,
        'True error message is displayed for "' + inputSelector + '" with "' + value + '" value')
      .then(() => this.checkMultirackVerification());
  },
  checkMultirackVerification() {
    return this.remote
      .assertElementDisabled(this.btnSaveSelector, '"Save Settings" button is disabled')
      .then(() => this.gotoNodeNetworkSubTab('Connectivity Check'))
      .assertElementDisabled(this.btnVerifySelector, '"Verify Networks" button is disabled')
      .then(() => this.gotoNodeNetworkSubTab('default'));
  },
  saveSettings() {
    return this.remote
      .assertElementEnabled(this.btnSaveSelector, '"Save Settings" button is enabled')
      .clickByCssSelector(this.btnSaveSelector)
      .assertElementDisabled(this.btnSaveSelector, '"Save Settings" button is disabled')
      .assertElementNotExists('div.has-error', 'Settings saved successfully');
  },
  cancelChanges() {
    return this.remote
      .assertElementEnabled(this.btnCancelSelector, '"Cancel Changes" button is enabled')
      .clickByCssSelector(this.btnCancelSelector)
      .assertElementDisabled(this.btnCancelSelector, '"Cancel Changes" button is disabled')
      .assertElementNotExists('div.has-error', 'Settings canceled successfully');
  },
  createNetworkGroup(groupName) {
    return this.remote
      .findByCssSelector(this.allNetSelector)
        .isSelected()
        .then((isSelected) => this.createNetworkGroup_Body(groupName, true, isSelected))
        .end()
      .catch(() => this.createNetworkGroup_Body(groupName, false, false))
      .catch((error) => {
        this.remote.then(() => this.modal.close());
        throw new Error('Unexpected error via network group creation: ' + error);
      });
  },
  createNetworkGroup_Body(groupName, allNetExists, allNetSelected) {
    var groupSelector = 'div[data-name="' + groupName + '"] ';
    var btnAddGroupSelector = '.add-nodegroup-btn';
    var groupNameSelector = 'input.node-group-input-name';
    var chain = this.remote;
    // Precondition check
    if (allNetExists) {
      if (allNetSelected) {
        chain = chain.assertElementEnabled(this.allNetSelector + ':checked',
          '"Show All Networks" checkbox is enabled and selected before new group creation');
      } else {
        chain = chain.assertElementNotSelected(this.allNetSelector + ':enabled',
          '"Show All Networks" checkbox is enabled and not selected before new group creation');
      }
    } else {
      chain = chain.assertElementNotExists(this.allNetSelector,
          '"Show All Networks" checkbox not exists before new group creation');
    }
    // Generic body
    chain = chain.assertElementEnabled(btnAddGroupSelector, '"Add Network Group" button is enabled')
    .clickByCssSelector(btnAddGroupSelector)
    .then(() => this.modal.waitToOpen())
    .then(() => this.modal.checkTitle('Add New Node Network Group'))
    .assertElementEnabled(groupNameSelector, '"Modal name" textfield is enabled')
    .setInputValue(groupNameSelector, groupName)
    .then(() => this.modal.clickFooterButton('Add Group'))
    .then(() => this.modal.waitToClose());
    // Postcondition check
    if (allNetSelected) {
      chain = chain.assertElementAppears(groupSelector, 1000,
        '"' + groupName + '" node network group appears at "All Networks" pane')
      .assertElementEnabled(this.allNetSelector + ':checked',
        '"Show All Networks" checkbox is enabled and selected after new group creation');
    } else {
      chain = chain.assertElementDisappears(this.netGroupNameSelector + '.explanation', 1000,
        'New subtab is shown')
      .findByCssSelector(this.netGroupListSelector + 'li.active')
        .assertElementTextEquals('a', groupName,
          'New network group is appears, selected and name is correct')
        .end()
      .assertElementTextEquals(this.netGroupNameSelector + '.btn-link', groupName,
        '"' + groupName + '" node network group title appears')
      .assertElementNotSelected(this.allNetSelector + ':enabled',
        '"Show All Networks" checkbox is enabled and not selected after new group creation');
    }
    return chain;
  },
  deleteNetworkGroup(groupName) {
    var netGroupLeftSelector = this.netGroupListSelector + 'a';
    return this.remote
      .then(() => this.gotoNodeNetworkSubTab(groupName))
      .catch(() => this.gotoNodeNetworkSubTab('All Networks'))
      .findAllByCssSelector(this.netGroupNameSelector)
        .then((netGroupNames) => {
          if (netGroupNames.length >= 2) {
            return this.deleteNetworkGroup_Body(groupName, true, netGroupNames.length);
          } else {
            return this.remote.findAllByCssSelector(netGroupLeftSelector)
            .then((netGroupsLeft) => {
              if (netGroupsLeft.length >= 2) {
                return this.deleteNetworkGroup_Body(groupName, false, netGroupsLeft.length);
              } else {
                throw new Error('Cannot delete last (default) node network group');
              }
            })
            .end();
          }
        })
        .end()
      .catch((error) => {
        throw new Error('Unexpected error via network group deletion: ' + error);
      });
  },
  deleteNetworkGroup_Body(groupName, allNetSelected, numGroups) {
    var groupSelector = 'div[data-name="' + groupName + '"] ';
    var removeSelector = groupSelector + 'i.glyphicon-remove-alt';
    var chain = this.remote;
    // Precondition check
    if (allNetSelected) {
      chain = chain.assertElementEnabled(this.allNetSelector + ':checked',
        '"Show All Networks" checkbox is enabled and selected before group deletion');
    } else {
      chain = chain.assertElementNotSelected(this.allNetSelector + ':enabled',
        '"Show All Networks" checkbox is enabled and not selected before group deletion');
    }
    // Generic body
    chain = chain.assertElementAppears(removeSelector, 1000, 'Remove icon is shown')
    .clickByCssSelector(removeSelector)
    .then(() => this.modal.waitToOpen())
    .then(() => this.modal.checkTitle('Remove Node Network Group'))
    .then(() => this.modal.clickFooterButton('Delete'))
    .then(() => this.modal.waitToClose());
    // Postcondition check
    if ((numGroups > 2 && !allNetSelected) || (numGroups <= 2)) {
      chain = chain.assertElementAppears(this.netGroupNameSelector + '.explanation', 1000,
        'Default subtab is shown')
      .assertElementNotContainsText(this.netGroupListSelector, groupName,
        '"' + groupName + '" node network group disappears from network group list')
      .assertElementNotContainsText(this.netGroupNameSelector + '.btn-link', groupName,
        '"' + groupName + '" node network group title disappears from "Networks" tab');
      if (numGroups <= 2) {
        chain = chain.assertElementNotExists(this.allNetSelector,
          '"Show All Networks" checkbox not exists after group deletion');
      } else {
        chain = chain.assertElementNotSelected(this.allNetSelector + ':enabled',
          '"Show All Networks" checkbox is enabled and not selected after group deletion');
      }
    } else {
      chain = chain.assertElementDisappears(groupSelector, 1000,
        '"' + groupName + '" node network group disappears from "All Networks" subtab')
      .assertElementEnabled(this.allNetSelector + ':checked',
          '"Show All Networks" checkbox is enabled and selected after group deletion');
    }
    return chain;
  },
  checkNeutronL3ForBaremetal() {
    return this.remote
      .assertElementNotExists('div.baremetal div.has-error', 'No Baremetal errors are observed')
      .assertElementExists('a[class$="neutron_l3"]', '"Neutron L3" link is existed')
      .clickByCssSelector('a[class$="neutron_l3"]')
      .assertElementEnabled('input[name="range-start_baremetal_range"]',
        '"Ironic IP range" Start textfield is enabled')
      .assertElementEnabled('input[name="range-end_baremetal_range"]',
        '"Ironic IP range" End textfield is enabled')
      .assertElementEnabled('input[name="baremetal_gateway"]',
        '"Ironic gateway " textfield is enabled');
  },
  checkBaremetalIntersection(networkName, intersectionValues) {
    // Input array: Values to raise baremetal intersection: [Baremetal CIDR, Baremetal Start IP,
    // Baremetal End IP, Ironic Start IP, Ironic End IP, Ironic Gateway]
    var cidrSelector = 'div.baremetal div.cidr input[type="text"]';
    var startSelector = 'div.baremetal div.ip_ranges input[name*="range-start"]';
    var endSelector = 'div.baremetal div.ip_ranges input[name*="range-end"]';
    var baremetalGatewaySelector = 'input[name="baremetal_gateway"]';
    var baremetalStartSelector = 'input[name="range-start_baremetal_range"]';
    var baremetalEndSelector = 'input[name="range-end_baremetal_range"]';
    var networkAlertSelector = 'div.network-alert';
    return this.remote
      .setInputValue(cidrSelector, intersectionValues[0])
      .setInputValue(startSelector, intersectionValues[1])
      .setInputValue(endSelector, intersectionValues[2])
      .then(() => this.checkNeutronL3ForBaremetal())
      .setInputValue(baremetalStartSelector, intersectionValues[3])
      .setInputValue(baremetalEndSelector, intersectionValues[4])
      .setInputValue(baremetalGatewaySelector, intersectionValues[5])
      .assertElementNotExists('div.form-baremetal-network div.has-error',
        'No Ironic errors are observed for Storage and Baremetal intersection')
      .then(() => this.gotoNodeNetworkSubTab('default'))
      .assertElementEnabled(this.btnSaveSelector, '"Save Settings" button is enabled')
      .clickByCssSelector(this.btnSaveSelector)
      .assertElementEnabled('div.' + networkName + ' div.cidr div.has-error input[type="text"]',
        networkName + ' "CIDR" textfield is "red" marked')
      .assertElementEnabled('div.baremetal div.cidr div.has-error input[type="text"]',
        'Baremetal "CIDR" textfield is "red" marked')
      .assertElementExists(networkAlertSelector, 'Error message is observed')
      .assertElementContainsText(networkAlertSelector,
        'Address space intersection between networks', 'True error message is displayed')
      .assertElementContainsText(networkAlertSelector, networkName,
        'True error message is displayed')
      .assertElementContainsText(networkAlertSelector, 'baremetal',
        'True error message is displayed')
      .then(() => this.cancelChanges());
  },
  checkDefaultNetGroup() {
    return this.remote
      .assertElementContainsText('ul.node_network_groups', 'default',
        '"default" network group is shown and name is correct')
      .assertElementPropertyEquals('ul.node_network_groups li[role="presentation"]',
        'offsetTop', '50', 'First node network group is found')
      .assertElementTextEquals('ul.node_network_groups  li[role="presentation"]', 'default',
        '"default" network group is on top');
  },
  checkGateways(groupName, neutronType) {
    var chain = this.remote;
    chain = chain.assertElementDisabled('div.storage input[name="gateway"]',
      'Storage "Gateway" field exists and disabled for "' + groupName + '" network group')
    .assertElementDisabled('div.management input[name="gateway"]',
      'Management "Gateway" field exists and disabled for "' + groupName + '" network group');
    if (neutronType === 'VLAN') {
      chain = chain.assertElementDisabled('div.private input[name="gateway"]',
        'Private "Gateway" field exists and disabled for "' + groupName + '" network group');
    }
    return chain;
  },
  checkVLANs(groupName, neutronType) {
    var chain = this.remote;
    chain = chain.assertElementPropertyEquals('div.storage div.vlan_start input[type="text"]',
      'value', '102', 'Storage "Use VLAN tagging" textfield has default value for "' +
      groupName + '" network group')
    .assertElementPropertyEquals('div.management div.vlan_start input[type="text"]',
      'value', '101', 'Management "Use VLAN tagging" textfield has default value for "' +
      groupName + '" network group');
    if (neutronType === 'VLAN') {
      chain = chain.assertElementPropertyEquals('div.private div.vlan_start input[type="text"]',
        'value', '103', 'Private "Use VLAN tagging" textfield has default value for "' +
        groupName + '" network group');
    }
    chain = chain.assertElementDisabled(this.btnSaveSelector, '"Save Settings" btn is disabled')
    .assertElementDisabled(this.btnCancelSelector, '"Cancel Changes" button is disabled')
    .assertElementNotExists('div.has-error', 'No errors are observed');
    return chain;
  },
  checkCidrOption(networkName) {
    var netSelector = 'div.' + networkName.toLowerCase() + ' ';
    var cidrSelector = netSelector + 'div.cidr input[type="checkbox"]';
    var ipStartSelector = netSelector + 'div.ip_ranges input[name*="range-start"]';
    var ipEndSelector = netSelector + 'div.ip_ranges input[name*="range-end"]';
    var defaultIpRange = {Storage: '1', Management: '0', Private: '2', Baremetal: '3'};
    return this.remote
      .assertElementEnabled(cidrSelector,
        networkName + ' "Use the whole CIDR" checkbox is enabled before changing')
      .findByCssSelector(cidrSelector)
        .isSelected()
        .then((cidrStatus) => this.selectCidrWay(
          networkName, cidrStatus, cidrSelector, ipStartSelector, ipEndSelector))
        .end()
      .assertElementPropertyEquals(ipStartSelector, 'value',
        '192.168.' + defaultIpRange[networkName] + '.1',
        networkName + ' "Start IP Range" textfield  has default value')
      .assertElementPropertyEquals(ipEndSelector, 'value',
        '192.168.' + defaultIpRange[networkName] + '.254',
        networkName + ' "End IP Range" textfield has default value')
      .assertElementNotExists(netSelector + 'div.has-error',
        'No ' + networkName + ' errors are observed');
  },
  selectCidrWay(networkName, cidrStatus, cidrSelector, ipStartSelector, ipEndSelector) {
    var chain = this.remote;
    chain = chain.clickByCssSelector(cidrSelector)
    .assertElementEnabled(cidrSelector,
      networkName + ' "Use the whole CIDR" checkbox is enabled after changing');
    if (cidrStatus) {
      chain = chain.assertElementNotSelected(cidrSelector,
        networkName + ' "Use the whole CIDR" checkbox is not selected')
      .assertElementEnabled(ipStartSelector,
        networkName + ' "Start IP Range" textfield is enabled')
      .assertElementEnabled(ipEndSelector,
        networkName + ' "End IP Range" textfield is enabled');
    } else {
      chain = chain.assertElementSelected(cidrSelector,
        networkName + ' "Use the whole CIDR" checkbox is selected')
      .assertElementDisabled(ipStartSelector,
        networkName + ' "Start IP Range" textfield is disabled')
      .assertElementDisabled(ipEndSelector,
        networkName + ' "End IP Range" textfield is disabled');
    }
    return chain;
  },
  addNewIpRange(networkName, newIpRange) {
    // Works only with last range!
    // Input array "newIpRange": [Start IP, End IP]
    var chain = this.remote;
    var netSelector = 'div.' + networkName.toLowerCase() + ' ';
    var rowRangeSelector = netSelector + 'div.range-row';
    var lastRangeSelector = rowRangeSelector + ':last-child ';
    var addRangeSelector = lastRangeSelector + 'button.ip-ranges-add ';
    var ipStartSelector = 'input[name*="range-start"]';
    var ipEndSelector = 'input[name*="range-end"]';
    chain = chain.assertElementEnabled(addRangeSelector, 'IP range add button enabled')
    .findAllByCssSelector(rowRangeSelector)
      .then((elements) =>
        this.checkIpRange(addRangeSelector, rowRangeSelector, elements.length + 1))
      .end()
    .assertElementEnabled(lastRangeSelector + ipStartSelector,
      networkName + ' new "Start IP Range" textfield is enabled')
    .assertElementEnabled(lastRangeSelector + ipEndSelector,
      networkName + ' new "End IP Range" textfield is enabled')
    .assertElementPropertyEquals(lastRangeSelector + ipStartSelector, 'placeholder',
      this.defaultPlaceholder,
      networkName + ' new "Start IP Range" textfield has default placeholder')
    .assertElementPropertyEquals(lastRangeSelector + ipEndSelector, 'placeholder',
      this.defaultPlaceholder,
      networkName + ' new "End IP Range" textfield has default placeholder');
    if (newIpRange) {
      chain = chain.setInputValue(lastRangeSelector + ipStartSelector, newIpRange[0])
      .setInputValue(lastRangeSelector + ipEndSelector, newIpRange[1])
      .assertElementPropertyEquals(lastRangeSelector + ipStartSelector, 'value', newIpRange[0],
        networkName + ' new "Start IP Range" textfield has new value')
      .assertElementPropertyEquals(lastRangeSelector + ipEndSelector, 'value', newIpRange[1],
        networkName + ' new "End IP Range" textfield has new value');
    }
    chain = chain.assertElementNotExists(netSelector + 'div.has-error',
      'No ' + networkName + ' errors are observed');
    return chain;
  },
  deleteIpRange(networkName, rangeRow) {
    var netSelector = 'div.' + networkName.toLowerCase() + ' ';
    var rowRangeSelector = netSelector + 'div.range-row';
    var rowSelector = rowRangeSelector + ':last-child ';
    if (rangeRow) {
      rowSelector = rowRangeSelector + ':nth-child(' + (rangeRow + 1).toString() + ') ';
    }
    var delRangeSelector = rowSelector + 'button.ip-ranges-delete';
    return this.remote
      .assertElementsExist(rowSelector, networkName + ' IP Range to delete exists')
      .assertElementEnabled(delRangeSelector, networkName + ' IP Range delete button enabled')
      .findAllByCssSelector(rowRangeSelector)
        .then(
          (elements) => this.checkIpRange(delRangeSelector, rowRangeSelector, elements.length - 1)
        )
        .end()
      // Add more powerfull check of range deletion (values disappears)
      .assertElementNotExists(netSelector + 'div.has-error',
        'No ' + networkName + ' errors are observed');
  },
  checkIpRange(addremoveRangeSelector, rowRangeSelector, numRanges) {
    return this.remote
      .clickByCssSelector(addremoveRangeSelector)
      .sleep(500)
      .assertElementsExist(rowRangeSelector, numRanges, 'Correct number of IP ranges exists');
  },
  checkIpRanges(networkName) {
    var netSelector = 'div.' + networkName.toLowerCase() + ' ';
    var cidrSelector = netSelector + 'div.cidr input[type="text"]';
    var ipStartSelector = netSelector + 'div.ip_ranges input[name*="range-start"]';
    var ipStartErrorSel = netSelector + 'div.ip_ranges div.has-error input[name*="range-start"]';
    var ipEndSelector = netSelector + 'div.ip_ranges input[name*="range-end"]';
    var ipEndErrorSel = netSelector + 'div.ip_ranges div.has-error input[name*="range-end"]';
    var networkAlertSelector = netSelector + 'div.ip_ranges div.validation-error';
    var initValue = '192.168.';
    var errorValue = '192.168.5.0/24';
    var errorValues = ['.*', '.279', '.254', '.1', '.5'];
    var defaultIpRange = {Storage: '1', Management: '0', Private: '2'};
    return this.remote
      .assertElementEnabled(cidrSelector, networkName + ' "CIDR" textfield is enabled')
      .assertElementEnabled(ipStartSelector, networkName + ' "Start IP Range" txtfld is enabled')
      .assertElementEnabled(ipEndSelector, networkName + ' "End IP Range" textfield is enabled')
      // Check #1
      .setInputValue(ipStartSelector, initValue + defaultIpRange[networkName] + errorValues[0])
      .assertElementsExist(ipStartErrorSel,
        networkName + ' "Start IP Range" textfield is "red" marked')
      .assertElementMatchesRegExp(networkAlertSelector, /Invalid IP address/i,
        'True error message is displayed')
      .then(() => this.cancelChanges())
      // Check #2
      .setInputValue(ipEndSelector, initValue + defaultIpRange[networkName] + errorValues[1])
      .assertElementsExist(ipEndErrorSel,
        networkName + ' "End IP Range" textfield is "red" marked')
      .assertElementMatchesRegExp(networkAlertSelector, /Invalid IP address/i,
        'True error message is displayed')
      .then(() => this.cancelChanges())
      // Check #3
      .setInputValue(cidrSelector, errorValue)
      .assertElementsExist(ipStartErrorSel,
        networkName + ' "Start IP Range" textfield is "red" marked')
      .assertElementsExist(ipEndErrorSel,
        networkName + ' "End IP Range" textfield is "red" marked')
      .assertElementMatchesRegExp(networkAlertSelector,
        /IP address does not match the network CIDR/i, 'True error message is displayed')
      .then(() => this.cancelChanges())
      // Check #4
      .setInputValue(ipStartSelector, initValue + defaultIpRange[networkName] + errorValues[2])
      .setInputValue(ipEndSelector, initValue + defaultIpRange[networkName] + errorValues[3])
      .assertElementsExist(ipStartErrorSel,
        networkName + ' "Start IP Range" textfield is "red" marked')
      .assertElementsExist(ipEndErrorSel,
        networkName + ' "End IP Range" textfield is "red" marked')
      .assertElementMatchesRegExp(networkAlertSelector,
        /Start IP address must be less than end IP address/i, 'True error message is displayed')
      .then(() => this.cancelChanges())
      // Check #5
      .setInputValue(ipStartSelector, initValue + defaultIpRange[networkName] + errorValues[4])
      .setInputValue(ipEndSelector, initValue + defaultIpRange[networkName] + errorValues[4])
      .then(() => this.saveSettings())
      // Check #6
      .setInputValue(ipStartSelector, ' ')
      .assertElementsExist(ipStartErrorSel,
        networkName + ' "Start IP Range" textfield is "red" marked')
      .assertElementMatchesRegExp(networkAlertSelector, /Invalid IP address/i,
        'True error message is displayed')
      .then(() => this.cancelChanges())
      // Check #7
      .setInputValue(ipEndSelector, ' ')
      .assertElementsExist(ipEndErrorSel,
        networkName + ' "End IP Range" textfield is "red" marked')
      .assertElementMatchesRegExp(networkAlertSelector, /Invalid IP address/i,
        'True error message is displayed')
      .then(() => this.cancelChanges());
  },
  checkNerworksIntersection(networkNameToEdit, networkName, editValues) {
    // Input array "editValues": [CIDR, Start IP, End IP]
    var netSelector1 = 'div.' + networkNameToEdit.toLowerCase() + ' ';
    var cidrSelector = netSelector1 + 'div.cidr input[type="text"]';
    var cidrErrorSelector = 'div.cidr div.has-error input[type="text"]';
    var ipStartSelector = netSelector1 + 'div.ip_ranges input[name*="range-start"]';
    var ipEndSelector = netSelector1 + 'div.ip_ranges input[name*="range-end"]';
    var netSelector2 = 'div.' + networkName.toLowerCase() + ' ';
    var networkAlertSelector = 'div.network-alert';
    var networkAlertMessage = RegExp(
      'Address space intersection between networks[\\s\\S]*' +
      '(' + networkNameToEdit + '.*|' + networkName + '.*){2}[\\s\\S]*', 'i');
    return this.remote
      .assertElementEnabled(cidrSelector,
        networkNameToEdit + ' "CIDR" textfield is enabled')
      .assertElementEnabled(ipStartSelector,
        networkNameToEdit + ' "Start IP Range" textfield is enabled')
      .assertElementEnabled(ipEndSelector,
        networkNameToEdit + ' "End IP Range" textfield is enabled')
      .setInputValue(cidrSelector, editValues[0])
      .setInputValue(ipStartSelector, editValues[1])
      .setInputValue(ipEndSelector, editValues[2])
      .assertElementEnabled(this.btnSaveSelector, '"Save Settings" button is enabled')
      .clickByCssSelector(this.btnSaveSelector)
      .assertElementAppears(netSelector1 + cidrErrorSelector, 1000,
        networkNameToEdit + ' "CIDR" textfield is "red" marked')
      .assertElementAppears(netSelector2 + cidrErrorSelector, 500,
        networkName + ' "CIDR" textfield is "red" marked')
      .assertElementsExist(networkAlertSelector, 'Error message is observed')
      .assertElementMatchesRegExp(networkAlertSelector, networkAlertMessage,
        'True error message is displayed for intersection between' +
        networkNameToEdit + ' and ' + networkName + ' networks')
      .then(() => this.cancelChanges());
  },
  checkMergedNetworksGrouping(networkNamesArray) {
    // Input array "networkNamesArray": [name#1, name#2, ...] by their position on page
    var netSelector1 = 'div.col-xs-10 div:nth-child(';
    var netSelector2 = ') ' + this.netGroupNameSelector + 'div.name';
    var chain = this.remote;
    chain = chain.assertElementsAppear(this.allNetSelector + ':enabled:checked', 1000,
      '"Show All Networks" checkbox is enabled and selected');
    for (var i = 1; i <= networkNamesArray.length; i++) {
      chain = chain.waitForCssSelector(netSelector1 + i + netSelector2, 1000)
      .assertElementContainsText(netSelector1 + i + netSelector2, networkNamesArray[i - 1],
        '"' + networkNamesArray[i - 1] + '" network group true positioned and has correct name');
    }
    return chain;
  },
  checkNetworksGrouping(networkNamesArray) {
    // Input array "networkNamesArray": [name#1, name#2, ...] by their position on page
    var netSelector1 = this.netGroupListSelector + 'li:nth-child(';
    var netSelector2 = ') a';
    var chain = this.remote;
    for (var i = 2; i < networkNamesArray.length + 2; i++) {
      chain = chain.waitForCssSelector(netSelector1 + i + netSelector2, 1000)
      .assertElementContainsText(netSelector1 + i + netSelector2, networkNamesArray[i - 2],
        '"' + networkNamesArray[i - 2] + '" network group true positioned and has correct name');
    }
    return chain;
  },
  selectAllNetworksCheckbox(toSelectBool) {
    // Input var "toSelectBool": true - select checkbox, false - unselect
    return this.remote
      .assertElementsExist(this.allNetSelector, '"Show All Networks" checkbox exists')
      .findByCssSelector(this.allNetSelector)
        .isSelected()
        .then((isSelected) => {
          if (isSelected && !toSelectBool) {
            return this.remote.clickByCssSelector(this.allNetSelector)
            .assertElementNotSelected(this.allNetSelector,
              '"Show All Networks" checkbox is not selected');
          } else if (!isSelected && toSelectBool) {
            return this.remote.clickByCssSelector(this.allNetSelector)
            .assertElementSelected(this.allNetSelector,
              '"Show All Networks" checkbox is selected');
          }
        })
        .end();
  },
  checkHelpPopover(toolTipSelector, popoverText) {
    var popoverSelector = '.popover.in.right.requirements-popover';
    return this.remote
      .waitForCssSelector(toolTipSelector, 2000)
      .findByCssSelector(toolTipSelector)
        .then((element) => this.remote.moveMouseTo(element))
        .end()
      // The following timeout as we have 0.3s transition for the popover
      .sleep(300)
      .assertElementMatchesRegExp(popoverSelector, popoverText, 'popover text is OK');
  },
  renameNetworkGroup(oldName, newName) {
    var oldGroupSelector = 'div[data-name="' + oldName + '"] ';
    var newGroupSelector = 'div[data-name="' + newName + '"] ';
    var pencilSelector = oldGroupSelector + 'i.glyphicon-pencil';
    var renameSelector = oldGroupSelector + 'input[name="new-name"]';
    return this.remote
      .assertElementsAppear(pencilSelector, 1000, '"Pencil" icon appears')
      .clickByCssSelector(pencilSelector)
      .assertElementAppears(renameSelector, 1000, 'Node network group renaming control appears')
      .findByCssSelector(renameSelector)
        .clearValue()
        .type(newName)
        .type('\uE007')
        .end()
      .assertElementsAppear(newGroupSelector, 1000, 'New network group appears')
      .assertElementNotExists(oldGroupSelector, 'Old network group is not exist');
  }
};

export default NetworksLib;
