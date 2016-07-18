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

import 'tests/functional/helpers';
import ModalWindow from 'tests/functional/pages/modal';
import GenericLib from 'tests/functional/nightly/library/generic';

class NetworksGenericLib {
  constructor(remote) {
    this.remote = remote;
    this.modal = new ModalWindow(remote);
    this.generic = new GenericLib(remote);

    this.netGroupListSelector = 'ul.node_network_groups ';
    this.allNetSelector = 'input.show-all-networks:enabled';
    this.btnAddGroupSelector = 'button.add-nodegroup-btn';
    this.btnSaveSelector = 'button.apply-btn';
    this.btnCancelSelector = 'button.btn-revert-changes';
    this.btnVerifySelector = 'button.verify-networks-btn';
    this.errorSelector = 'div.has-error ';
    this.netGroupNamePaneSelector = 'div.network-group-name ';
    this.netGroupNameSelector = this.netGroupNamePaneSelector + 'div.name';
    this.netGroupInfoSelector = this.netGroupNamePaneSelector + 'span.explanation';
    this.showMsg = '"Show All Networks" checkbox is ';
  }

  goToNodeNetworkSubTab(groupName) {
    var networkSubTabSelector = 'div[id="network-subtabs"]';
    return this.remote
      .assertElementAppears(networkSubTabSelector, 1000, 'Network subtab list exists')
      .assertElementContainsText(networkSubTabSelector, groupName, groupName + ' link exists')
      .findByCssSelector(networkSubTabSelector)
        .clickLinkByText(groupName)
        .sleep(500)
        .assertElementContainsText('li.active', groupName, groupName + ' link is opened')
        .end();
  }

  saveSettings() {
    return this.remote
      .assertElementEnabled(this.btnSaveSelector, '"Save Settings" button is enabled')
      .clickByCssSelector(this.btnSaveSelector)
      .assertElementDisabled(this.btnSaveSelector, '"Save Settings" button is disabled')
      .assertElementNotExists(this.errorSelector, 'Settings saved successfully');
  }

  cancelChanges() {
    return this.remote
      .assertElementEnabled(this.btnCancelSelector, '"Cancel Changes" button is enabled')
      .clickByCssSelector(this.btnCancelSelector)
      .assertElementDisabled(this.btnCancelSelector, '"Cancel Changes" button is disabled')
      .assertElementNotExists(this.errorSelector, 'Settings canceled successfully');
  }

  checkNetworkSettingsSegment(neutronType) {
    var netDescSelector = 'div.network-description';
    var startSelector = 'input[name^="range-start"]';
    var endSelector = 'input[name^="range-end"]';
    var spanSelector = 'span.subtab-group-';
    var dvrSelector = 'input[name="neutron_dvr"]:disabled';
    var l2PopSelector = 'input[name="neutron_l2_pop"]:enabled';
    if (neutronType.toLowerCase() === 'vlan') {
      l2PopSelector = dvrSelector = 'input[name="neutron_dvr"]:enabled';
    }
    var l2Msg = '"Neutron L2" ';
    var floatMsg = '"Floating Network" ';
    var adminMsg = '"Admin Tenant Network" ';
    var dnsMsg = '"Guest OS DNS Servers" ';
    var extMsg = '"Host OS Servers" ';
    var l2NetMsg = RegExp('Neutron supports different types of network segmentation such as ' +
      'VLAN, GRE, VXLAN etc. This section is specific to (VLAN|a tunneling) segmentation related ' +
      'parameters such as (VLAN|Tunnel) ID ranges for tenant separation and the Base MAC address');
    var floatNetMsg = RegExp('This network is used to assign Floating IPs to tenant VMs');
    var adminNetMsg = RegExp('This Admin Tenant network provides internal network access for ' +
      'instances. It can be used only by the Admin tenant.');
    var dnsNetMsg = RegExp('This setting is used to specify the upstream name servers for the ' +
      'environment. These servers will be used to forward DNS queries for external DNS names to ' +
      'DNS servers outside the environment');
    var extNetMsg = RegExp('Host OS (DNS|NTP) Servers');
    return this.remote
      // Neutron L2 subtab
      .clickByCssSelector('a.subtab-link-neutron_l2')
      .assertElementExists('li.active a.subtab-link-neutron_l2', l2Msg + 'subtab is selected')
      .assertElementTextEquals('h3.networks', 'Neutron L2 Configuration', l2Msg + 'subtab isopened')
      .assertElementMatchesRegExp(netDescSelector, l2NetMsg, l2Msg + 'description is correct')
      .assertElementEnabled(startSelector, '"VLAN/Tunnel ID range" start textfield is enabled')
      .assertElementEnabled(endSelector, '"VLAN/Tunnel ID range" end textfield is enabled')
      .assertElementEnabled('input[name="base_mac"]', '"Base MAC address" textfield is enabled')
      // Neutron L3 subtab
      .clickByCssSelector('a.subtab-link-neutron_l3')
      .assertElementExists('li.active a.subtab-link-neutron_l3', '"Neutron L3" subtab is selected')
      .findByCssSelector('div.form-floating-network')
        .assertElementTextEquals('h3', 'Floating Network Parameters', floatMsg + 'name is correct')
        .assertElementMatchesRegExp(netDescSelector, floatNetMsg, floatMsg + 'description correct')
        .assertElementEnabled(startSelector, floatMsg + 'ip range start textfield is enabled')
        .assertElementEnabled(endSelector, floatMsg + 'ip range end textfield is enabled')
        .assertElementEnabled('input[name="floating_name"]', floatMsg + 'name textfield is enabled')
        .end()
      .findByCssSelector('div.form-internal-network')
        .assertElementTextEquals('h3', 'Admin Tenant Network Parameters', adminMsg + 'name correct')
        .assertElementMatchesRegExp(netDescSelector, adminNetMsg, adminMsg + 'description correct')
        .assertElementEnabled('input[name="internal_cidr"]', adminMsg + 'CIDR textfield is enabled')
        .assertElementEnabled('input[name="internal_gateway"]', adminMsg + 'gateway txtfld enabled')
        .assertElementEnabled('input[name="internal_name"]', adminMsg + 'name textfield is enabled')
        .end()
      .findByCssSelector('div.form-dns-nameservers')
        .assertElementTextEquals('h3', 'Guest OS DNS Servers', dnsMsg + 'name is correct')
        .assertElementMatchesRegExp(netDescSelector, dnsNetMsg, dnsMsg + 'description is correct')
        .assertElementsExist('input[name=dns_nameservers]', 2, dnsMsg + 'both txtfields are exists')
        .end()
      // Other subtab
      .clickByCssSelector('a.subtab-link-network_settings')
      .assertElementExists('li.active a.subtab-link-network_settings', '"Other" subtab is selected')
      .assertElementTextEquals(spanSelector + 'public_network_assignment',
        'Public network assignment', '"Public network assignment" name is correct')
      .assertElementEnabled('input[name="assign_to_all_nodes"]',
        '"Assign public network to all nodes" checkbox is enabled')
      .assertElementTextEquals(spanSelector + 'neutron_advanced_configuration',
        'Neutron Advanced Configuration', '"Neutron Advanced Configuration" name is correct')
      .assertElementEnabled('input[name="neutron_l3_ha"]', '"Neutron L3 HA" checkbox enabled')
      .assertElementExists(dvrSelector, '"Neutron DVR" checkbox exists and is enabled/disabled')
      .assertElementExists(l2PopSelector, l2Msg + 'population checkbox is not exist/exists')
      .assertElementMatchesRegExp(spanSelector + 'external_dns', extNetMsg, extMsg + 'name correct')
      .assertElementEnabled('input[name="dns_list"]', '"DNS list" textfield is enabled')
      .assertElementMatchesRegExp(spanSelector + 'external_ntp', extNetMsg, extMsg + 'name correct')
      .assertElementEnabled('input[name="ntp_list"]', '"NTP server list" textfield is enabled');
  }

  checkNetworkVerificationSegment() {
    var connectSelector = 'div.connect-';
    var verifyNodeSelector = 'div.verification-node-';
    var descSelector = 'ol.verification-description';
    var descMsg = RegExp('Network verification checks the following[\\s\\S]*L2 connectivity ' +
      'checks between nodes in the environment[\\s\\S]*DHCP discover check on all nodes[\\s\\S]*' +
      'Repository connectivity check from the Fuel Master node[\\s\\S]*Repository connectivity ' +
      'check from the Fuel Slave nodes through the public & admin.*PXE.*networks[\\s\\S]*', 'i');
    return this.remote
      .then(() => this.goToNodeNetworkSubTab('Connectivity Check'))
      // Check default picture router scheme
      .findByCssSelector('div.verification-network-placeholder')
        .assertElementExists('div.verification-router', 'Main router picture is observed')
        .assertElementExists(connectSelector + '1', 'Connection line "left" node #1 is observed')
        .assertElementExists(connectSelector + '2', 'Connection line "center" node #2 is observed')
        .assertElementExists(connectSelector + '3', 'Connection line "right" node #3 is observed')
        .assertElementExists(verifyNodeSelector + '1', '"Left" node #1 picture is observed')
        .assertElementExists(verifyNodeSelector + '2', '"Center" node #2 picture is observed')
        .assertElementExists(verifyNodeSelector + '3', '"Right" node #3 picture is observed')
        .end()
      // Check default verification description
      .assertElementExists(descSelector, '"Connectivity check" description is observed')
      .assertElementMatchesRegExp(descSelector, descMsg, '"Connectivity check" description correct')
      .assertElementExists(this.btnVerifySelector, '"Verify Networks" exists')
      .assertElementDisabled(this.btnCancelSelector, '"Cancel Changes" button is disabled')
      .assertElementDisabled(this.btnSaveSelector, '"Save Settings" button is disabled');
  }

  checkIncorrectValueInput(inputSelector, value, errorSelector, errorMessage) {
    var errorMsg = 'Error message appears for "' + inputSelector + '" with "' + value + '" value';
    return this.remote
      .assertElementEnabled(inputSelector, '"' + inputSelector + '" is enabled')
      .setInputValue(inputSelector, value)
      .assertElementAppears(errorSelector, 1000, errorMsg)
      .assertElementContainsText(errorSelector, errorMessage, errorMsg + ' has correct decription')
      .then(() => this.checkMultirackVerification());
  }

  checkMultirackVerification() {
    return this.remote
      .assertElementDisabled(this.btnSaveSelector, '"Save Settings" button is disabled')
      .then(() => this.goToNodeNetworkSubTab('Connectivity Check'))
      .assertElementDisabled(this.btnVerifySelector, '"Verify Networks" button is disabled')
      .then(() => this.goToNodeNetworkSubTab('default'));
  }

  createNetworkGroup(groupName) {
    return this.remote
      .findByCssSelector(this.allNetSelector)
        .isSelected()
        .then((isSelected) => this.createNetworkGroupBody(groupName, true, isSelected))
        .end()
      .catch(() => this.createNetworkGroupBody(groupName, false, false))
      .catch((error) => {
        this.remote.then(() => this.modal.close());
        throw new Error('Unexpected error via network group creation: ' + error);
      });
  }

  createNetworkGroupBody(groupName, allNetExists, allNetSelected) {
    var groupSelector = 'div[data-name="' + groupName + '"] ';
    var groupNameSelector = 'input.node-group-input-name';
    var bfMsg = ' before new group creation';
    var afterMsg = ' after new group creation';
    var chain = this.remote;
    // Precondition check
    if (!allNetExists) {
      chain = chain.assertElementNotExists(this.allNetSelector, this.showMsg + 'not exist' + bfMsg);
    } else if (allNetSelected) {
      chain = chain.assertElementSelected(this.allNetSelector, this.showMsg + 'selected' + bfMsg);
    } else {
      chain = chain.assertElementNotSelected(this.allNetSelector, this.showMsg + 'not sel' + bfMsg);
    }
    // Generic body
    chain = chain.assertElementEnabled(this.btnAddGroupSelector, '"Add Network Group" btn enabled')
    .clickByCssSelector(this.btnAddGroupSelector)
    .then(() => this.modal.waitToOpen())
    .then(() => this.modal.checkTitle('Add New Node Network Group'))
    .assertElementEnabled(groupNameSelector, '"Modal name" textfield is enabled')
    .setInputValue(groupNameSelector, groupName)
    .then(() => this.modal.clickFooterButton('Add Group'))
    .then(() => this.modal.waitToClose());
    // Postcondition check
    if (allNetSelected) {
      chain = chain.assertElementSelected(this.allNetSelector, this.showMsg + 'selected' + afterMsg)
      .assertElementAppears(groupSelector, 1000, groupName + ' node network group appears');
    } else {
      chain = chain.assertElementDisappears(this.netGroupInfoSelector, 1000, 'New subtab is shown')
      .assertElementTextEquals(this.netGroupListSelector + 'li.active a', groupName,
        'New network group is appears, selected and name is correct')
      .assertElementContainsText(this.netGroupNameSelector, groupName, groupName + ' title appears')
      .assertElementNotSelected(this.allNetSelector, this.showMsg + 'not selected' + afterMsg);
    }
    return chain;
  }

  deleteNetworkGroup(groupName) {
    var netGroupLeftSelector = this.netGroupListSelector + 'a';
    return this.remote
      .then(() => {
        return this.remote.then(() => this.goToNodeNetworkSubTab(groupName))
        .assertElementNotSelected(this.allNetSelector, this.showMsg + 'not sel-ed before group del')
        .findAllByCssSelector(netGroupLeftSelector)
          .then((groups) => this.deleteNetworkGroupBody(groupName, false, groups.length))
          .end();
      })
      .catch(() => {
        return this.remote.then(() => this.goToNodeNetworkSubTab('All Networks'))
        .assertElementSelected(this.allNetSelector, this.showMsg + 'selected before group deletion')
        .findAllByCssSelector(this.netGroupNamePaneSelector)
          .then((groups) => this.deleteNetworkGroupBody(groupName, true, groups.length))
          .end();
      })
      .catch((error) => {throw new Error('Cannot delete default node network group: ' + error);});
  }

  deleteNetworkGroupBody(groupName, allNetSelected, numGroups) {
    var groupSelector = 'div[data-name="' + groupName + '"] ';
    var removeSelector = groupSelector + 'i.glyphicon-remove-alt';
    var afterMsg = this.showMsg + 'after group deletion ';
    var tmpMsg = '"' + groupName + '" node network group disappears from ';
    var chain = this.remote;
    // Generic body
    chain = chain.assertElementAppears(removeSelector, 1000, 'Remove icon is shown')
    .clickByCssSelector(removeSelector)
    .then(() => this.modal.waitToOpen())
    .then(() => this.modal.checkTitle('Remove Node Network Group'))
    .then(() => this.modal.clickFooterButton('Delete'))
    .then(() => this.modal.waitToClose());
    // Postcondition check
    if ((numGroups > 2 && !allNetSelected) || (numGroups <= 2)) {
      chain = chain.assertElementAppears(this.netGroupInfoSelector, 1000, 'Default subtab is shown')
      .assertElementNotContainsText(this.netGroupListSelector, groupName, tmpMsg + 'net group list')
      .assertElementNotContainsText(this.netGroupNameSelector, groupName, tmpMsg + 'Networks tab');
      if (numGroups <= 2) {
        chain = chain.assertElementNotExists(this.allNetSelector, afterMsg + 'is not exist');
      } else {
        chain = chain.assertElementNotSelected(this.allNetSelector, afterMsg + 'is not selected');
      }
    } else {
      chain = chain.assertElementDisappears(groupSelector, 1000, tmpMsg + '"All Networks" subtab')
      .assertElementSelected(this.allNetSelector, afterMsg + 'is selected');
    }
    return chain;
  }

  checkDefaultNetworkGroup() {
    var defSelector = this.netGroupListSelector + 'li[role="presentation"]';
    return this.remote
      .assertElementContainsText(this.netGroupListSelector, 'default', 'Name is correct')
      .assertElementPropertyEquals(defSelector, 'offsetTop', '50', 'First node net group is found')
      .assertElementTextEquals(defSelector, 'default', '"default" network group is on top');
  }

  checkGateways(groupName, neutronType) {
    var infoMsg = ' "Gateway" field exists and disabled for "' + groupName + '" network group';
    var chain = this.remote;
    chain = chain.assertElementDisabled('div.storage input[name="gateway"]', 'Storage' + infoMsg)
    .assertElementDisabled('div.management input[name="gateway"]', 'Management' + infoMsg);
    if (neutronType.toLowerCase() === 'vlan') {
      chain = chain.assertElementDisabled('div.private input[name="gateway"]', 'Private' + infoMsg);
    }
    return chain;
  }

  checkVLANs(groupName, neutronType) {
    var vlanSelector = ' div.vlan_start input[type="text"]';
    var msg = 'Use VLAN tagging" textfield has default value for "' + groupName + '" network group';
    var chain = this.remote;
    chain = chain.assertElementPropertyEquals('div.storage' + vlanSelector, 'value', '102', msg)
    .assertElementPropertyEquals('div.management' + vlanSelector, 'value', '101', msg);
    if (neutronType.toLowerCase() === 'vlan') {
      chain = chain.assertElementPropertyEquals('div.private' + vlanSelector, 'value', '103', msg);
    }
    chain = chain.assertElementDisabled(this.btnSaveSelector, '"Save Settings" btn is disabled')
    .assertElementDisabled(this.btnCancelSelector, '"Cancel Changes" button is disabled')
    .assertElementNotExists(this.errorSelector, 'No Networks errors are observed');
    return chain;
  }

  checkMergedNetworksGrouping(networkNamesArray) {
    // Input array "networkNamesArray": [name#1, name#2, ...] by their position on page
    var netSelector1 = 'div.col-xs-10 div:nth-child(';
    var netSelector2 = ') ' + this.netGroupNameSelector;
    var chain = this.remote;
    chain.assertElementsAppear(this.allNetSelector + ':checked', 1000, this.showMsg + 'appear');
    for (var i = 1; i <= networkNamesArray.length; i++) {
      chain = chain.waitForCssSelector(netSelector1 + i + netSelector2, 1000)
      .assertElementContainsText(netSelector1 + i + netSelector2, networkNamesArray[i - 1],
        '"' + networkNamesArray[i - 1] + '" network group true positioned and has correct name');
    }
    return chain;
  }

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
  }

  selectAllNetworks(toSelectBool) {
    // Input var "toSelectBool": true - select checkbox, false - unselect
    return this.remote
      .assertElementsExist(this.allNetSelector, '"Show All Networks" checkbox exists')
      .findByCssSelector(this.allNetSelector)
        .isSelected()
        .then((isSelected) => {
          if (isSelected && !toSelectBool) {
            return this.remote.clickByCssSelector(this.allNetSelector)
            .assertElementNotSelected(this.allNetSelector, '"Show All Networks" is not selected');
          } else if (!isSelected && toSelectBool) {
            return this.remote.clickByCssSelector(this.allNetSelector)
            .assertElementSelected(this.allNetSelector, '"Show All Networks" is selected');
          } else {
            return false;
          }
        })
        .end();
  }

  checkHelpPopover(toolTipSelector, popoverText) {
    var popoverSelector = 'div.requirements-popover';
    return this.remote
      .waitForCssSelector(toolTipSelector, 2000)
      .then(() => this.generic.moveCursorTo(toolTipSelector))
      .assertElementAppears(popoverSelector, 500, 'Help popover appears')
      .assertElementMatchesRegExp(popoverSelector, popoverText, 'Help popover text is correct');
  }

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
}

export default NetworksGenericLib;
