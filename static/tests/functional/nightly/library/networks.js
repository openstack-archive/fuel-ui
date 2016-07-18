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
import _ from 'intern/dojo/node!lodash';
import ModalWindow from 'tests/functional/pages/modal';
import GenericLib from 'tests/functional/nightly/library/generic';

class NetworksLib {
  constructor(remote, networkName) {
    this.remote = remote;
    this.modal = new ModalWindow(remote);
    this.generic = new GenericLib(remote);
    this.networkName = 'public';
    if (networkName) {
      this.networkName = networkName.toLowerCase();
    }
    this.networkSelector = 'div.' + this.networkName + ' ';

    this.netGroupListSelector = 'ul.node_network_groups ';
    this.allNetSelector = 'input.show-all-networks:enabled';
    this.btnAddGroupSelector = 'button.add-nodegroup-btn';
    this.btnCancelSelector = 'button.btn-revert-changes';
    this.btnSaveSelector = 'button.apply-btn';
    this.btnVerifySelector = 'button.verify-networks-btn';
    this.errorSelector = 'div.has-error ';
    this.alertSelector = 'div.network-alert';
    this.rangeStartSelector = 'input[name*="range-start"]';
    this.rangeEndSelector = 'input[name*="range-end"]';
    this.baremetalGatewaySelector = 'input[name="baremetal_gateway"]';
    this.baremetalStartSelector = 'input[name="range-start_baremetal_range"]';
    this.baremetalEndSelector = 'input[name="range-end_baremetal_range"]';

    this.networkErrorSelector = this.networkSelector + this.errorSelector;
    this.networkErrorMessage = 'No "' + this.networkName + '"" network errors are observed';
    this.netGroupNamePaneSelector = 'div.network-group-name ';
    this.netGroupNameSelector = this.netGroupNamePaneSelector + 'div.name';
    this.netGroupInfoSelector = this.netGroupNamePaneSelector + 'span.explanation';
    this.cidrPaneSelector = this.networkSelector + 'div.cidr ';
    this.cidrErrorSelector = this.cidrPaneSelector + this.errorSelector;
    this.cidrValueSelector = this.cidrPaneSelector + 'input[type="text"]';
    this.cidrWholeSelector = this.cidrPaneSelector + 'input[type="checkbox"]';
    this.ipPaneSelector = this.networkSelector + 'div.ip_ranges ';
    this.ipRangeRowSelector = this.ipPaneSelector + 'div.range-row';
    this.ipLastRowSelector = this.ipRangeRowSelector + ':last-child ';
    this.addRangeSelector = this.ipLastRowSelector + 'button.ip-ranges-add';
    this.ipErrorSelector = this.ipLastRowSelector + this.errorSelector;
    this.ipStartErrorSelector = this.ipErrorSelector + this.rangeStartSelector;
    this.ipEndErrorSelector = this.ipErrorSelector + this.rangeEndSelector;
    this.ipStartSelector = this.ipLastRowSelector + this.rangeStartSelector;
    this.ipEndSelector = this.ipLastRowSelector + this.rangeEndSelector;
    this.vlanPaneSelector = this.networkSelector + 'div.vlan-tagging ';
    this.vlanTagSelector = this.vlanPaneSelector + 'input[type="checkbox"]';
    this.vlanValueSelector = this.vlanPaneSelector + 'input[type="text"]';

    this.networkNames = ['public', 'storage', 'management', 'baremetal', 'private'];
    if (!_.includes(this.networkNames, this.networkName)) {
      throw new Error('Check networkName parameter value: "' + networkName + '" and restart test.' +
        ' True values are: ' + this.networkNames);
    }
    this.defaultIpRanges = {storage: '1', management: '0', baremetal: '3', private: '2'};
    this.defaultIpRange = '192.168.' + this.defaultIpRanges[this.networkName] + '.';
    this.defaultPlaceholder = '127.0.0.1';
    this.cidrMessage = '"' + this.networkName + '" "Use the whole CIDR" ';
    this.startMessage = '"' + this.networkName + '" "Start IP Range" ';
    this.endMessage = '"' + this.networkName + '" "End IP Range" ';
    this.vlanMessage = '"' + this.networkName + '" "Use VLAN tagging" ';
    this.startTxtFldMsg = this.startMessage + 'textfield is enabled';
    this.endTxtFldMsg = this.startMessage + 'textfield is enabled';
    this.showMsg = '"Show All Networks" checkbox is ';
  }

  gotoNodeNetworkSubTab(groupName) {
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

  checkNetworkInitialState() {
    var ipRangeRowSelector = 'div.col-xs-10 div:first-child ' + this.ipRangeRowSelector;
    var gatewaySelector = this.networkSelector + 'input[name="gateway"][type="text"]';
    var defaultMsg = 'textfield has default value';
    var cidrMsg = this.cidrMessage + defaultMsg;
    var startMsg = this.startMessage + defaultMsg;
    var endMsg = this.endMessage + defaultMsg;
    var vlanMsg = this.vlanMessage + defaultMsg;
    var prop = 'value';
    var chain = this.remote;
    // Generic components: CIDR, IP Ranges, VLAN
    chain = chain.assertElementDisabled(this.btnSaveSelector, '"Save Settings" button is disabled')
    .assertElementDisabled(this.btnCancelSelector, '"Cancel Changes" button is disabled')
    .assertElementNotExists(this.errorSelector, 'No Networks errors are observed')
    .assertElementEnabled(this.cidrValueSelector, this.cidrMessage + 'textfield is enabled')
    .assertElementEnabled(this.cidrWholeSelector, this.cidrMessage + 'checkbox is enabled')
    .assertElementsExist(ipRangeRowSelector, 1, 'Only one default IP range is observed')
    .assertElementEnabled(this.vlanTagSelector, this.vlanMessage + 'checkbox is enabled');
    // Individual components: CIDR, IP Ranges, Gateway, VLAN by networks
    if (this.networkName === 'public' || this.networkName === 'baremetal') {
      chain = chain.assertElementEnabled(this.addRangeSelector, '"Add IP range" button is enabled')
      .assertElementNotSelected(this.cidrWholeSelector, this.cidrMessage + 'checkbox isnt selected')
      .assertElementEnabled(this.ipStartSelector, this.startTxtFldMsg)
      .assertElementEnabled(this.ipEndSelector, this.endTxtFldMsg);
      if (this.networkName === 'public') {
        chain = chain.assertElementPropertyEquals(this.ipEndSelector, prop, '172.16.0.126', endMsg)
        .assertElementPropertyEquals(this.ipStartSelector, prop, '172.16.0.2', startMsg)
        .assertElementPropertyEquals(this.cidrValueSelector, prop, '172.16.0.0/24', cidrMsg)
        .assertElementEnabled(gatewaySelector, '"Gateway" textfield is enabled')
        .assertElementPropertyEquals(gatewaySelector, prop, '172.16.0.1', '"Gateway" ' + defaultMsg)
        .assertElementNotSelected(this.vlanTagSelector, this.vlanMessage + 'chkbox is not selected')
        .assertElementNotExists(this.vlanValueSelector, this.vlanMessage + 'txtfield is not exist');
      } else if (this.networkName === 'baremetal') {
        chain = chain.assertElementPropertyEquals(this.ipEndSelector, prop, '192.168.3.50', endMsg)
        .assertElementPropertyEquals(this.ipStartSelector, prop, '192.168.3.2', startMsg)
        .assertElementPropertyEquals(this.cidrValueSelector, prop, '192.168.3.0/24', cidrMsg)
        .assertElementSelected(this.vlanTagSelector, this.vlanMessage + 'checkbox is selected')
        .assertElementEnabled(this.vlanValueSelector, this.vlanMessage + 'textfield is enabled')
        .assertElementPropertyEquals(this.vlanValueSelector, prop, '104', vlanMsg);
      }
    } else {
      chain = chain.assertElementDisabled(this.addRangeSelector, '"Add IP range" btn is disabled')
      .assertElementSelected(this.cidrWholeSelector, this.cidrMessage + 'checkbox is selected')
      .assertElementDisabled(this.ipStartSelector, this.startMessage + 'textfield is disabled')
      .assertElementDisabled(this.ipEndSelector, this.endMessage + 'textfield is disabled')
      .assertElementSelected(this.vlanTagSelector, this.vlanMessage + 'checkbox is selected')
      .assertElementEnabled(this.vlanValueSelector, this.vlanMessage + 'textfield is enabled');
      if (this.networkName === 'storage') {
        chain = chain.assertElementPropertyEquals(this.vlanValueSelector, prop, '102', vlanMsg)
        .assertElementPropertyEquals(this.cidrValueSelector, prop, '192.168.1.0/24', cidrMsg)
        .assertElementPropertyMatchesRegExp(this.ipStartSelector, prop, /192.168.1.1|2/i, startMsg)
        .assertElementPropertyEquals(this.ipEndSelector, prop, '192.168.1.254', endMsg);
      } else if (this.networkName === 'management') {
        chain = chain.assertElementPropertyEquals(this.vlanValueSelector, prop, '101', vlanMsg)
        .assertElementPropertyEquals(this.cidrValueSelector, prop, '192.168.0.0/24', cidrMsg)
        .assertElementPropertyMatchesRegExp(this.ipStartSelector, prop, /192.168.0.1|2/i, startMsg)
        .assertElementPropertyEquals(this.ipEndSelector, prop, '192.168.0.254', endMsg);
      } else if (this.networkName === 'private') {
        chain = chain.assertElementPropertyEquals(this.vlanValueSelector, prop, '103', vlanMsg)
        .assertElementPropertyEquals(this.cidrValueSelector, prop, '192.168.2.0/24', cidrMsg)
        .assertElementPropertyEquals(this.ipStartSelector, prop, '192.168.2.1', startMsg)
        .assertElementPropertyEquals(this.ipEndSelector, prop, '192.168.2.254', endMsg);
      }
    }
    return chain;
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
      .then(() => this.gotoNodeNetworkSubTab('Connectivity Check'))
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

  checkNetworkIpRanges(correctIpRange, newIpRange) {
    return this.remote
      // "Use the whole CIDR" option works
      .then(() => this.checkCidrOption())
      .then(() => this.saveSettings())
      // Correct changing of "IP Ranges" works
      .setInputValue(this.ipStartSelector, correctIpRange[0])
      .setInputValue(this.ipEndSelector, correctIpRange[1])
      .then(() => this.saveSettings())
      .assertElementPropertyEquals(this.ipStartSelector, 'value', correctIpRange[0],
        this.startMessage + 'textfield has correct new value')
      .assertElementPropertyEquals(this.ipEndSelector, 'value', correctIpRange[1],
        this.endMessage + 'textfield has correct new value')
      // Adding and deleting additional "IP Ranges" fields
      .then(() => this.addNewIpRange(newIpRange))
      .then(() => this.saveSettings())
      .then(() => this.deleteIpRange())
      .then(() => this.saveSettings())
      // Check "IP Ranges" Start and End validation
      .then(() => this.checkIpRanges());
  }

  checkCidrOption() {
    return this.remote
      .assertElementEnabled(this.cidrWholeSelector, this.cidrMessage + 'chbox enable before change')
      .findByCssSelector(this.cidrWholeSelector)
        .isSelected()
        .then((cidrStatus) => this.selectCidrWay(cidrStatus))
        .end()
      .assertElementPropertyEquals(this.ipStartSelector, 'value', this.defaultIpRange + '1',
        this.startMessage + 'textfield has default value')
      .assertElementPropertyEquals(this.ipEndSelector, 'value', this.defaultIpRange + '254',
        this.endMessage + 'textfield has default value')
      .assertElementNotExists(this.networkErrorSelector, this.networkErrorMessage);
  }

  selectCidrWay(cidrStatus) {
    var cidrMsg = this.cidrMessage + 'checkbox is ';
    var chain = this.remote;
    chain = chain.clickByCssSelector(this.cidrWholeSelector)
    .assertElementEnabled(this.cidrWholeSelector, cidrMsg + 'enabled after changing');
    if (cidrStatus) {
      chain = chain.assertElementNotSelected(this.cidrWholeSelector, cidrMsg + 'not selected')
      .assertElementEnabled(this.ipStartSelector, this.startTxtFldMsg)
      .assertElementEnabled(this.ipEndSelector, this.endTxtFldMsg);
    } else {
      chain = chain.assertElementSelected(this.cidrWholeSelector, cidrMsg + 'selected')
      .assertElementDisabled(this.ipStartSelector, this.startMessage + 'textfield is disabled')
      .assertElementDisabled(this.ipEndSelector, this.endMessage + 'textfield is disabled');
    }
    return chain;
  }

  addNewIpRange(newIpRange) {
    var chain = this.remote;
    chain = chain.assertElementEnabled(this.addRangeSelector, 'IP range add button enabled')
    .findAllByCssSelector(this.ipRangeRowSelector)
      .then((elements) => this.checkIpRange(this.addRangeSelector, elements.length + 1))
      .end()
    .assertElementEnabled(this.ipStartSelector, 'New ' + this.startTxtFldMsg)
    .assertElementEnabled(this.ipEndSelector, 'New ' + this.endTxtFldMsg)
    .assertElementPropertyEquals(this.ipStartSelector, 'placeholder', this.defaultPlaceholder,
      'New ' + this.startMessage + 'textfield has default placeholder')
    .assertElementPropertyEquals(this.ipEndSelector, 'placeholder', this.defaultPlaceholder,
      'New ' + this.endMessage + 'textfield has default placeholder');
    if (newIpRange) {
      chain = chain.setInputValue(this.ipStartSelector, newIpRange[0])
      .setInputValue(this.ipEndSelector, newIpRange[1])
      .assertElementPropertyEquals(this.ipStartSelector, 'value', newIpRange[0],
        'New ' + this.startMessage + 'textfield has new value')
      .assertElementPropertyEquals(this.ipEndSelector, 'value', newIpRange[1],
        'New ' + this.endMessage + 'textfield has new value');
    }
    chain = chain.assertElementNotExists(this.networkErrorSelector, this.networkErrorMessage);
    return chain;
  }

  deleteIpRange(rangeRow) {
    var workRowSelector = this.ipLastRowSelector;
    if (rangeRow) {
      workRowSelector = this.ipRangeRowSelector + ':nth-child(' + (rangeRow + 1).toString() + ') ';
    }
    var delRangeSelector = workRowSelector + 'button.ip-ranges-delete';
    return this.remote
      .assertElementsExist(workRowSelector, this.networkName + ' IP Range to delete exists')
      .assertElementEnabled(delRangeSelector, this.networkName + ' IP Range delete btn is enabled')
      .findAllByCssSelector(this.ipRangeRowSelector)
        .then((elements) => this.checkIpRange(delRangeSelector, elements.length - 1))
        .end()
      // Add more powerfull check of range deletion (values disappears)
      .assertElementNotExists(this.networkErrorSelector, this.networkErrorMessage);
  }

  checkIpRange(addremoveRangeSelector, numRows) {
    return this.remote
      .clickByCssSelector(addremoveRangeSelector)
      .sleep(500)
      .assertElementsExist(this.ipRangeRowSelector, numRows, 'Correct number of IP ranges exists');
  }

  checkIpRanges() {
    var validationSelector = this.ipPaneSelector + 'div.validation-error';
    var errorCidrValue = '192.168.5.0/24';
    var errorStartValues = [this.defaultIpRange + '*', ' ', this.defaultIpRange + '254'];
    var errorEndValues = [this.defaultIpRange + '279', ' ', this.defaultIpRange + '1'];
    var startIpMessage = this.startMessage + 'textfield is "red" marked';
    var endIpMessage = this.endMessage + 'textfield is "red" marked';
    var trueErrorMessage = 'True error message is displayed';
    var chain = this.remote;
    chain = chain.assertElementEnabled(this.cidrValueSelector, this.cidrMessage + 'txtfld enabled')
    .assertElementEnabled(this.ipStartSelector, this.startTxtFldMsg)
    .assertElementEnabled(this.ipEndSelector, this.endTxtFldMsg);
    for (var i = 0; i < 2; i++) {
      // Check ip start field
      chain = chain.setInputValue(this.ipStartSelector, errorStartValues[i])
      .assertElementsExist(this.ipStartErrorSelector, startIpMessage)
      .assertElementMatchesRegExp(validationSelector, /Invalid IP address/i, trueErrorMessage)
      .then(() => this.cancelChanges());
      // Check ip end field
      chain = chain.setInputValue(this.ipEndSelector, errorEndValues[i])
      .assertElementsExist(this.ipEndErrorSelector, endIpMessage)
      .assertElementMatchesRegExp(validationSelector, /Invalid IP address/i, trueErrorMessage)
      .then(() => this.cancelChanges());
    }
    // Check ip start, end fields simultaneously
    chain = chain.setInputValue(this.ipStartSelector, errorStartValues[2])
    .setInputValue(this.ipEndSelector, errorEndValues[2])
    .assertElementsExist(this.ipStartErrorSelector, startIpMessage)
    .assertElementsExist(this.ipEndErrorSelector, endIpMessage)
    .assertElementMatchesRegExp(validationSelector,
      /Start IP address must be less than end IP address/i, trueErrorMessage)
    .then(() => this.cancelChanges());
    // Check cidr field
    chain = chain.setInputValue(this.cidrValueSelector, errorCidrValue)
    .assertElementsExist(this.ipStartErrorSelector, startIpMessage)
    .assertElementsExist(this.ipEndErrorSelector, endIpMessage)
    .assertElementMatchesRegExp(validationSelector,
      /IP address does not match the network CIDR/i, trueErrorMessage)
    .then(() => this.cancelChanges());
    return chain;
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
      .then(() => this.gotoNodeNetworkSubTab('Connectivity Check'))
      .assertElementDisabled(this.btnVerifySelector, '"Verify Networks" button is disabled')
      .then(() => this.gotoNodeNetworkSubTab('default'));
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
        return this.remote.then(() => this.gotoNodeNetworkSubTab(groupName))
        .assertElementNotSelected(this.allNetSelector, this.showMsg + 'not sel-ed before group del')
        .findAllByCssSelector(netGroupLeftSelector)
          .then((groups) => this.deleteNetworkGroupBody(groupName, false, groups.length))
          .end();
      })
      .catch(() => {
        return this.remote.then(() => this.gotoNodeNetworkSubTab('All Networks'))
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

  checkNeutronL3ForBaremetal() {
    return this.remote
      .assertElementNotExists(this.networkErrorSelector, this.networkErrorMessage)
      .assertElementExists('a[class$="neutron_l3"]', '"Neutron L3" link is existed')
      .clickByCssSelector('a[class$="neutron_l3"]')
      .assertElementEnabled(this.baremetalStartSelector, '"Ironic IP range" start field is enabled')
      .assertElementEnabled(this.baremetalEndSelector, '"Ironic IP range" end textfield is enabled')
      .assertElementEnabled(this.baremetalGatewaySelector, '"Ironic gateway" textfield is enabled');
  }

  checkBaremetalIntersection(networkName, intersectionValues) {
    // Input array: Values to raise baremetal intersection:
    // [Brmt CIDR, Brmt Start IP, Brmt End IP, Ironic Start IP, Ironic End IP, Ironic Gateway]
    var errorSelector1 = 'div.form-baremetal-network ' + this.errorSelector;
    var errorSelector2 = 'div.' + networkName.toLowerCase() + ' div.cidr ' + this.errorSelector;
    return this.remote
      .setInputValue(this.cidrValueSelector, intersectionValues[0])
      .setInputValue(this.ipStartSelector, intersectionValues[1])
      .setInputValue(this.ipEndSelector, intersectionValues[2])
      .then(() => this.checkNeutronL3ForBaremetal())
      .setInputValue(this.baremetalStartSelector, intersectionValues[3])
      .setInputValue(this.baremetalEndSelector, intersectionValues[4])
      .setInputValue(this.baremetalGatewaySelector, intersectionValues[5])
      .assertElementNotExists(errorSelector1, 'No Ironic errors are observed')
      .then(() => this.gotoNodeNetworkSubTab('default'))
      .assertElementEnabled(this.btnSaveSelector, '"Save Settings" button is enabled')
      .clickByCssSelector(this.btnSaveSelector)
      .assertElementEnabled(this.cidrErrorSelector, this.cidrMessage + 'textfield is "red" marked')
      .assertElementEnabled(errorSelector2, networkName + ' "CIDR" textfield is "red" marked')
      .assertElementExists(this.alertSelector, 'Error message is observed')
      .assertElementContainsText(this.alertSelector, 'Address space intersection between networks',
        'True error message is displayed')
      .assertElementContainsText(this.alertSelector, networkName, 'True error message is displayed')
      .assertElementContainsText(this.alertSelector, 'baremetal', 'True error message is displayed')
      .then(() => this.cancelChanges());
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
    var msg = this.vlanMessage + 'txtfield has default value for "' + groupName + '" net group';
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

  checkNetworksIntersection(networkName, editValues) {
    // Input array "editValues": [CIDR, Start IP, End IP]
    var errorSelector = 'div.' + networkName.toLowerCase() + ' div.cidr ' + this.errorSelector;
    var alertMessage = RegExp('Address space intersection between networks[\\s\\S]*' +
      '(' + this.networkName + '.*|' + networkName + '.*){2}[\\s\\S]*', 'i');
    return this.remote
      .assertElementEnabled(this.cidrValueSelector, this.cidrMessage + 'textfield is enabled')
      .assertElementEnabled(this.ipStartSelector, this.startTxtFldMsg)
      .assertElementEnabled(this.ipEndSelector, this.endTxtFldMsg)
      .setInputValue(this.cidrValueSelector, editValues[0])
      .setInputValue(this.ipStartSelector, editValues[1])
      .setInputValue(this.ipEndSelector, editValues[2])
      .assertElementEnabled(this.btnSaveSelector, '"Save Settings" button is enabled')
      .clickByCssSelector(this.btnSaveSelector)
      .assertElementAppears(this.cidrErrorSelector, 1000, this.cidrMessage + 'txtfld is red marked')
      .assertElementAppears(errorSelector, 500, networkName + ' "CIDR" textfield is "red" marked')
      .assertElementsExist(this.alertSelector, 'Error message is observed')
      .assertElementMatchesRegExp(this.alertSelector, alertMessage, 'True error message is' +
        'displayed for intersection: ' + this.networkName + ' and ' + networkName + ' networks')
      .then(() => this.cancelChanges());
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

export default NetworksLib;
