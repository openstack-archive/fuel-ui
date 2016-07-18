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
import NetworksGenericLib from 'tests/functional/nightly/library/networks_generic';

class NetworksLib {
  constructor(remote, networkName) {
    this.remote = remote;
    this.networksLib = new NetworksGenericLib(this.remote);
    this.networkName = networkName.toLowerCase();
    this.networkSelector = 'div.' + this.networkName + ' ';

    this.btnCancelSelector = 'button.btn-revert-changes';
    this.btnSaveSelector = 'button.apply-btn';
    this.errorSelector = 'div.has-error ';
    this.alertSelector = 'div.network-alert';
    this.rangeStartSelector = 'input[name*="range-start"]';
    this.rangeEndSelector = 'input[name*="range-end"]';
    this.baremetalGatewaySelector = 'input[name="baremetal_gateway"]';
    this.baremetalStartSelector = 'input[name="range-start_baremetal_range"]';
    this.baremetalEndSelector = 'input[name="range-end_baremetal_range"]';

    this.networkErrorSelector = this.networkSelector + this.errorSelector;
    this.networkErrorMessage = 'No "' + this.networkName + '"" network errors are observed';
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
    this.startTextfieldMessage = this.startMessage + 'textfield is enabled';
    this.endTextfieldMessage = this.startMessage + 'textfield is enabled';
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
      .assertElementEnabled(this.ipStartSelector, this.startTextfieldMessage)
      .assertElementEnabled(this.ipEndSelector, this.endTextfieldMessage);
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

  checkNetworkIpRanges(correctIpRange, newIpRange) {
    return this.remote
      // "Use the whole CIDR" option works
      .then(() => this.checkCidrOption())
      .then(() => this.networksLib.saveSettings())
      // Correct changing of "IP Ranges" works
      .setInputValue(this.ipStartSelector, correctIpRange[0])
      .setInputValue(this.ipEndSelector, correctIpRange[1])
      .then(() => this.networksLib.saveSettings())
      .assertElementPropertyEquals(this.ipStartSelector, 'value', correctIpRange[0],
        this.startMessage + 'textfield has correct new value')
      .assertElementPropertyEquals(this.ipEndSelector, 'value', correctIpRange[1],
        this.endMessage + 'textfield has correct new value')
      // Adding and deleting additional "IP Ranges" fields
      .then(() => this.addNewIpRange(newIpRange))
      .then(() => this.networksLib.saveSettings())
      .then(() => this.deleteIpRange())
      .then(() => this.networksLib.saveSettings())
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
      .assertElementEnabled(this.ipStartSelector, this.startTextfieldMessage)
      .assertElementEnabled(this.ipEndSelector, this.endTextfieldMessage);
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
    .assertElementEnabled(this.ipStartSelector, 'New ' + this.startTextfieldMessage)
    .assertElementEnabled(this.ipEndSelector, 'New ' + this.endTextfieldMessage)
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
    .assertElementEnabled(this.ipStartSelector, this.startTextfieldMessage)
    .assertElementEnabled(this.ipEndSelector, this.endTextfieldMessage);
    for (var i = 0; i < 2; i++) {
      // Check ip start field
      chain = chain.setInputValue(this.ipStartSelector, errorStartValues[i])
      .assertElementsExist(this.ipStartErrorSelector, startIpMessage)
      .assertElementMatchesRegExp(validationSelector, /Invalid IP address/i, trueErrorMessage)
      .then(() => this.networksLib.cancelChanges());
      // Check ip end field
      chain = chain.setInputValue(this.ipEndSelector, errorEndValues[i])
      .assertElementsExist(this.ipEndErrorSelector, endIpMessage)
      .assertElementMatchesRegExp(validationSelector, /Invalid IP address/i, trueErrorMessage)
      .then(() => this.networksLib.cancelChanges());
    }
    // Check ip start, end fields simultaneously
    chain = chain.setInputValue(this.ipStartSelector, errorStartValues[2])
    .setInputValue(this.ipEndSelector, errorEndValues[2])
    .assertElementsExist(this.ipStartErrorSelector, startIpMessage)
    .assertElementsExist(this.ipEndErrorSelector, endIpMessage)
    .assertElementMatchesRegExp(validationSelector,
      /Start IP address must be less than end IP address/i, trueErrorMessage)
    .then(() => this.networksLib.cancelChanges());
    // Check cidr field
    chain = chain.setInputValue(this.cidrValueSelector, errorCidrValue)
    .assertElementsExist(this.ipStartErrorSelector, startIpMessage)
    .assertElementsExist(this.ipEndErrorSelector, endIpMessage)
    .assertElementMatchesRegExp(validationSelector,
      /IP address does not match the network CIDR/i, trueErrorMessage)
    .then(() => this.networksLib.cancelChanges());
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
      .then(() => this.networksLib.goToNodeNetworkSubTab('default'))
      .assertElementEnabled(this.btnSaveSelector, '"Save Settings" button is enabled')
      .clickByCssSelector(this.btnSaveSelector)
      .assertElementEnabled(this.cidrErrorSelector, this.cidrMessage + 'textfield is "red" marked')
      .assertElementEnabled(errorSelector2, networkName + ' "CIDR" textfield is "red" marked')
      .assertElementExists(this.alertSelector, 'Error message is observed')
      .assertElementContainsText(this.alertSelector, 'Address space intersection between networks',
        'True error message is displayed')
      .assertElementContainsText(this.alertSelector, networkName, 'True error message is displayed')
      .assertElementContainsText(this.alertSelector, 'baremetal', 'True error message is displayed')
      .then(() => this.networksLib.cancelChanges());
  }

  checkNetworksIntersection(networkName, editValues) {
    // Input array "editValues": [CIDR, Start IP, End IP]
    var errorSelector = 'div.' + networkName.toLowerCase() + ' div.cidr ' + this.errorSelector;
    var alertMessage = RegExp('Address space intersection between networks[\\s\\S]*' +
      '(' + this.networkName + '.*|' + networkName + '.*){2}[\\s\\S]*', 'i');
    return this.remote
      .assertElementEnabled(this.cidrValueSelector, this.cidrMessage + 'textfield is enabled')
      .assertElementEnabled(this.ipStartSelector, this.startTextfieldMessage)
      .assertElementEnabled(this.ipEndSelector, this.endTextfieldMessage)
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
      .then(() => this.networksLib.cancelChanges());
  }
}

export default NetworksLib;
