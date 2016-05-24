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
import ModalWindow from 'tests/functional/pages/modal';
import Common from 'tests/functional/pages/common';
import ClusterPage from 'tests/functional/pages/cluster';
import DashboardPage from 'tests/functional/pages/dashboard';
import Command from 'intern/dojo/node!leadfoot/Command';
import NetworksLib from 'tests/functional/nightly/library/networks';

registerSuite(() => {
  var common, clusterPage, clusterName, networksLib;

  return {
    name: 'Neutron tunneling segmentation',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      networksLib = new NetworksLib(this.remote);
      clusterName = common.pickRandomName('Tunneling Cluster');

      return this.remote
        .then(() => common.getIn())
        .then(
          () => common.createCluster(
            clusterName,
            {
              'Networking Setup'() {
                return this.remote
                  .clickByCssSelector('input[value*="neutron"][value$=":vlan"]')
                  .clickByCssSelector('input[value*="neutron"][value$=":tun"]');
              }
            }
          )
        )
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => common.addNodesToCluster(1, ['Compute']))
        .then(() => clusterPage.goToTab('Networks'));
    },
    'The same VLAN for different node network groups'() {
      return this.remote
        .then(() => networksLib.createNetworkGroup('Network_Group_1'))
        .then(() => networksLib.createNetworkGroup('Network_Group_2'))
        .then(() => networksLib.checkVLANs('Network_Group_2', 'VLAN'))
        .then(() => networksLib.gotoNodeNetworkSubTab('Network_Group_1'))
        .then(() => networksLib.checkVLANs('Network_Group_1', 'VLAN'))
        .then(() => networksLib.gotoNodeNetworkSubTab('default'))
        .then(() => networksLib.checkVLANs('default', 'VLAN'));
    },
    'Gateways appear for two or more node network groups'() {
      return this.remote
        .then(() => networksLib.gotoNodeNetworkSubTab('Network_Group_2'))
        .then(() => networksLib.checkGateways('Network_Group_2', 'VLAN'))
        .then(() => networksLib.gotoNodeNetworkSubTab('Network_Group_1'))
        .then(() => networksLib.checkGateways('Network_Group_1', 'VLAN'))
        .then(() => networksLib.gotoNodeNetworkSubTab('default'))
        .then(() => networksLib.checkGateways('default', 'VLAN'))
        .then(() => networksLib.gotoNodeNetworkSubTab('Network_Group_1'))
        .then(() => networksLib.deleteNetworkGroup('Network_Group_1'))
        .then(() => networksLib.checkDefaultNetGroup())
        .then(() => networksLib.checkGateways('default', 'VLAN'))
        .assertElementEnabled('div.public input[name="gateway"]',
          'Public "Gateway" field exists and enabled for "default" network group');
    }
  };
});

registerSuite(() => {
  var common, command, modal, clusterPage, clusterName, networksLib, dashboardPage;
  var networkName = 'Public';
  var publicSelector = 'div.' + networkName.toLowerCase() + ' ';
  var ipRangesSelector = publicSelector + 'div.ip_ranges ';
  var startIpSelector = ipRangesSelector + 'input[name*="range-start"] ';
  var gatewaySelector = publicSelector + 'input[name="gateway"] ';
  var errorSelector = 'div.has-error';
  var networkGroupsSelector = 'ul.node_network_groups';
  var btnSaveSelector = '.apply-btn';
  var addGroupSelector = '.add-nodegroup-btn';
  var pencilSelector = 'i.glyphicon-pencil';
  var renameSelector = 'input[name="new-name"]';
  var nameSelector = 'div.network-group-name .btn-link';
  var allNetSelector = 'input.show-all-networks';

  return {
    name: 'Neutron VLAN segmentation',
    setup() {
      common = new Common(this.remote);
      command = new Command(this.remote);
      modal = new ModalWindow(this.remote);
      clusterPage = new ClusterPage(this.remote);
      networksLib = new NetworksLib(this.remote);
      dashboardPage = new DashboardPage(this.remote);
      clusterName = common.pickRandomName('VLAN Cluster');

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName))
        .then(() => common.addNodesToCluster(2, ['Controller']))
        .then(() => common.addNodesToCluster(1, ['Compute']))
        .then(() => clusterPage.goToTab('Networks'));
    },
    'Can not create node network group with the name of already existing group'() {
      var errorHelpSelector = 'div.has-error.node-group-name span.help-block';
      return this.remote
        .then(() => networksLib.createNetworkGroup('Network_Group_1'))
        .assertElementEnabled(addGroupSelector, '"Add New Node Network Group" button is enabled')
        .clickByCssSelector(addGroupSelector)
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Add New Node Network Group'))
        .findByCssSelector('input.node-group-input-name')
          .clearValue()
          .type('Network_Group_1')
          .type('\uE007')
          .end()
        .assertElementAppears(errorHelpSelector, 1000, 'Error message appears')
        .assertElementContainsText(errorHelpSelector,
          'This node network group name is already taken', 'True error message presents')
        .then(() => modal.close());
    },
    'Check Networks extended help popups'() {
      var tooltipSelector = ' .popover-container i.tooltip-icon';
      var textAdmin = RegExp('For security reasons, isolate this network from the ' +
        'Private and Public networks.', 'i');
      var textPublic = RegExp('public and Floating IP ranges must share the same CIDR\\n' +
        'Each controller node requires one IP address from the Public IP range.\\n' +
        'Additionally, an OpenStack environment requires two IP addresses to use ' +
        'as virtual IP addresses and one IP address for the default gateway.\\n' +
        'If you have enabled Neutron DVR and plan to use floating IP address, ' +
        'allocate one IP address for each compute node.\\n' +
        'For more information on the Public IP requirements, see the Plugin documentation.', 'mi');
      var textStorage = RegExp('This is an internal network, therefore, assign a private ' +
        'IP address range.', 'i');
      var textManagement = RegExp('This is an internal network, therefore, assign a private ' +
        'IP address range.', 'i');
      var textNeutron = RegExp('One unique VLAN ID is required for each tenant network.', 'i');
      var textFloating = RegExp('Each defined tenant, including the Admin tenant, requires one IP' +
        ' address from the Floating range. This IP address goes to the virtual interface of ' +
        "the tenant's virtual router.", 'i');
      var textInternal = RegExp('For security reasons, isolate this network from the Private ' +
        'and Public networks.', 'i');
      var textDns = RegExp('This settings is used to specify Name Servers of user\’s ' +
        'preference if the default servers are not prefered.', 'i');
      return this.remote
        // Check "Admin (PXE)" network help popover
        .then(() => networksLib.checkHelpPopover('.fuelweb_admin' + tooltipSelector, textAdmin))
        // Check "Public" network help popover
        .then(() => networksLib.checkHelpPopover('.public' + tooltipSelector, textPublic))
        // Check "Storage" network help popover
        .then(() => networksLib.checkHelpPopover('.storage' + tooltipSelector, textStorage))
        // Check "Management" network help popover
        .then(() => networksLib.checkHelpPopover('.management' + tooltipSelector, textManagement))
        .clickByCssSelector('.subtab-link-neutron_l2')
        // Check "neutron L2" network help popover
        .then(() => networksLib.checkHelpPopover('.form-neutron-l2' + tooltipSelector, textNeutron))
        .clickByCssSelector('.subtab-link-neutron_l3')
        // Check "Floating" network settings help popover
        .then(() => networksLib.checkHelpPopover('.form-floating-network' + tooltipSelector,
         textFloating))
        // Check "Internal" network settings help popover
        .then(() => networksLib.checkHelpPopover('.form-internal-network' + tooltipSelector,
         textInternal))
        // Check "Guest OS DNS Servers" settings help popover
        .then(() => networksLib.checkHelpPopover('.form-dns-nameservers' + tooltipSelector,
         textDns));
    },
    'Check "Guest OS DNS Servers" extendable list'() {
      var addFieldButton = '.dns_nameservers .field-list .btn-add-field';
      var removeFieldButton = '.dns_nameservers .field-list .btn-remove-field';
      var fieldWithError = '.dns_nameservers .field-list .has-error';
      var invalidInputMessage = '.dns_nameservers .field-list .help-block.field-error';
      return this.remote
        .clickByCssSelector('.subtab-link-neutron_l3')
        // Sleep is needed to transition for "Neutron L3" subtab
        .waitForCssSelector(addFieldButton, 500)
        .assertElementsExist(addFieldButton, 2, '"add field" buttons should exist')
        .clickByCssSelector(removeFieldButton)
        .assertElementDisappears(removeFieldButton, 200, '"remove field" button has disappeared')
        .assertElementsExist(addFieldButton, 1, '1 "add field" btn should exist')
        .clickByCssSelector(addFieldButton)
        .clickByCssSelector(addFieldButton)
        .clickByCssSelector(addFieldButton)
        .clickByCssSelector(addFieldButton)
        .assertElementDisappears(addFieldButton, 200, '"add field" button has disappeared')
        .assertElementsExist(removeFieldButton, 5, 'quantity of "remove field" buttons equal 5')
        .clickByCssSelector(removeFieldButton)
        .clickByCssSelector(removeFieldButton)
        .clickByCssSelector(removeFieldButton)
        .clickByCssSelector(removeFieldButton)
        .assertElementDisappears(removeFieldButton, 200, '"remove field" button has disappeared')
        .assertElementsExist(addFieldButton, 1, '1 "add field" button should exist')
        // Check that new added input field got the same validation for input
        .assertElementExists(fieldWithError, 'invalid nameserver exists')
        .assertElementExists(invalidInputMessage, 'error message is shown')
        .assertElementDisabled(btnSaveSelector, '"Save Changes" button is disabled')
        .findByCssSelector(fieldWithError + ' input.form-control')
          .type(['8', '.', '8', '.', '8', '.'])
          // Sleep is needed to wait when regex check will done.
          .sleep(300)
          .type('8')
          // Sleep is needed to wait when regex check will done.
          .sleep(300)
          .end()
        .assertElementDisappears(fieldWithError, 500, 'The error message has dissappeared')
        .assertElementEnabled(btnSaveSelector);
    },
    'Check "Host OS DNS servers" extendable list'() {
      var fieldListSelector = '.setting-section-external_dns .field-list';
      var addFieldButton = fieldListSelector + ' .btn-add-field';
      var removeFieldButton = fieldListSelector + ' .btn-remove-field';
      var fieldWithError = fieldListSelector + ' .has-error';
      var invalidInputMessage = fieldWithError + ' .help-block.field-error';
      return this.remote
        .clickByCssSelector('.subtab-link-network_settings')
        // Sleep is needed to transition for "Other" subtab
        .waitForCssSelector(addFieldButton, 500)
        .assertElementsExist(addFieldButton, 2, '"add field" buttons should exist')
        .clickByCssSelector(removeFieldButton)
        .assertElementDisappears(removeFieldButton, 200, '"remove field" button has disappeared')
        .assertElementsExist(addFieldButton, 1, '1 "add field" button should exist')
        .clickByCssSelector(addFieldButton)
        .clickByCssSelector(addFieldButton)
        .assertElementDisappears(addFieldButton, 200, '"add field" button has disappeared')
        .assertElementsExist(removeFieldButton, 3, 'Quantity of "remove field" buttons equal 3')
        .clickByCssSelector(removeFieldButton)
        .clickByCssSelector(removeFieldButton)
        .assertElementDisappears(removeFieldButton, 200, '"remove field" button has disappeared')
        .assertElementsExist(addFieldButton, 1, '1 "add field" button should exist')
        .assertElementExists(fieldWithError, 'invalid nameserver exists')
        .assertElementExists(invalidInputMessage, 'error message appears')
        .assertElementDisabled(btnSaveSelector, '"Save changes" button is disabled')
        .findByCssSelector(fieldWithError + ' input.form-control')
          .type(['8', '.', '8', '.', '8', '.'])
          // Sleep is needed to wait when regexp check will done.
          .sleep(300)
          .type('8')
          // Sleep is needed to wait when regexp check will done.
          .sleep(300)
          .end()
        .assertElementDisappears(fieldWithError, 500, 'The error message has dissappeared')
        .assertElementEnabled(btnSaveSelector, '"Save Changes" button is disabled')
        .clickByCssSelector('button.btn-revert-changes')
        .clickLinkByText('Network_Group_1');
    },
    'Node network group deletion'() {
      return this.remote
        .then(() => networksLib.gotoNodeNetworkSubTab('default'))
        .assertElementNotExists('.glyphicon-remove',
          'It is not possible to delete default node network group')
        .assertElementContainsText('span.explanation',
          'This node network group uses a shared admin network and cannot be deleted',
          'Default node network group description presented')
        .then(() => networksLib.selectAllNetworksCheckbox(true))
        .then(() => networksLib.deleteNetworkGroup('Network_Group_1'));
    },
    'Default network group the first in a list'() {
      this.timeout = 45000;
      return this.remote
        .then(() => networksLib.createNetworkGroup('test'))
        .then(() => networksLib.checkDefaultNetGroup())
        .then(() => networksLib.selectAllNetworksCheckbox(true))
        .then(() => networksLib.checkMergedNetworksGrouping(['default', 'test']))
        .then(() => networksLib.createNetworkGroup('abc'))
        .then(() => networksLib.checkMergedNetworksGrouping(['default', 'test', 'abc']))
        .then(() => networksLib.selectAllNetworksCheckbox(false))
        .then(() => networksLib.checkDefaultNetGroup())
        .then(() => networksLib.createNetworkGroup('1234'))
        .then(() => networksLib.checkDefaultNetGroup())
        .then(() => networksLib.createNetworkGroup('yrter'))
        .then(() => networksLib.checkDefaultNetGroup())
        .then(() => networksLib.createNetworkGroup('+-934847fdjfjdbh'))
        .then(() => networksLib.checkDefaultNetGroup());
    },
    'Check that user returns to merged "All Networks" segment'() {
      var networkNames = ['default', 'test', 'abc', '1234', 'yrter', '+-934847fdjfjdbh'];
      var allNetworksSelector = 'li[class="all"]';
      return this.remote
        .then(() => networksLib.checkNetworksGrouping(networkNames))
        .then(() => networksLib.selectAllNetworksCheckbox(true))
        // Check after refreshing of page
        .then(() => networksLib.checkMergedNetworksGrouping(networkNames))
        .then(() => command.refresh())
        .assertElementsAppear(allNetSelector, 5000, 'Page refreshed successfully')
        .then(() => networksLib.checkMergedNetworksGrouping(networkNames))
        // Check after switching between cluster tabs
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => clusterPage.goToTab('Networks'))
        .then(() => networksLib.checkMergedNetworksGrouping(networkNames))
        .then(() => clusterPage.goToTab('Nodes'))
        .then(() => clusterPage.goToTab('Networks'))
        .then(() => networksLib.checkMergedNetworksGrouping(networkNames))
        .then(() => clusterPage.goToTab('Settings'))
        .then(() => clusterPage.goToTab('Networks'))
        .then(() => networksLib.checkMergedNetworksGrouping(networkNames))
        .then(() => clusterPage.goToTab('Logs'))
        .then(() => clusterPage.goToTab('Networks'))
        .then(() => networksLib.checkMergedNetworksGrouping(networkNames))
        .then(() => clusterPage.goToTab('Health Check'))
        .then(() => clusterPage.goToTab('Networks'))
        .then(() => networksLib.checkMergedNetworksGrouping(networkNames))
        // Check after switching between "Networks" segments
        .then(() => networksLib.gotoNodeNetworkSubTab('Neutron L2'))
        .assertElementsExist(allNetworksSelector, '"All Networks" segment exists and not selected')
        .then(() => networksLib.gotoNodeNetworkSubTab('Neutron L3'))
        .assertElementsExist(allNetworksSelector, '"All Networks" segment exists and not selected')
        .then(() => networksLib.gotoNodeNetworkSubTab('Other'))
        .assertElementsExist(allNetworksSelector, '"All Networks" segment exists and not selected')
        .then(() => networksLib.gotoNodeNetworkSubTab('Connectivity Check'))
        .assertElementsExist(allNetworksSelector, '"All Networks" segment exists and not selected')
        .then(() => networksLib.selectAllNetworksCheckbox(false));
    },
    'Check that "Show All Networks" checkbox worked as expected'() {
      var newIpRangeStart = '172.16.0.10';
      var defaultPlaceholder = '127.0.0.1';
      var testGroupSelector = 'div.col-xs-10 div:nth-child(2) ';
      var rowRangeSelector = publicSelector + 'div.range-row';
      var lastRangeSelector = rowRangeSelector + ':last-child ';
      var addRangeSelector = lastRangeSelector + 'button.ip-ranges-add';
      var ipStartSelector = lastRangeSelector + 'input[name*="range-start"]';
      var ipEndSelector = lastRangeSelector + 'input[name*="range-end"]';
      return this.remote
        // Check default values
        .then(() => networksLib.gotoNodeNetworkSubTab('default'))
        .then(() => networksLib.checkNetworkInitialState(networkName))
        .then(() => networksLib.checkNetworkInitialState('Storage'))
        .then(() => networksLib.checkNetworkInitialState('Management'))
        .then(() => networksLib.selectAllNetworksCheckbox(true))
        .then(() => networksLib.checkNetworkInitialState(networkName))
        .then(() => networksLib.checkNetworkInitialState('Storage'))
        .then(() => networksLib.checkNetworkInitialState('Management'))
        // Check changed settings
        .setInputValue(startIpSelector, newIpRangeStart)
        .assertElementPropertyEquals(startIpSelector, 'value', newIpRangeStart,
          '"default" group Public "End IP Range" textfield  has correct new value at merged pane')
        .clickByCssSelector(testGroupSelector + addRangeSelector)
        .assertElementsExist(testGroupSelector + rowRangeSelector, 2,
          'Correct number of IP ranges exists at merged pane')
        .assertElementPropertyEquals(testGroupSelector + ipStartSelector, 'placeholder',
          defaultPlaceholder,
          '"test" group Public new "Start IP Range" txtfld has default placeholder at merged pane')
        .assertElementPropertyEquals(testGroupSelector + ipEndSelector, 'placeholder',
          defaultPlaceholder,
          '"test" group Public new "End IP Range" textfield has default placeholder at merged pane')
        .then(() => networksLib.selectAllNetworksCheckbox(false))
        .assertElementPropertyEquals(startIpSelector, 'value', newIpRangeStart,
          '"default" group Public "End IP Range" textfield  has correct new value')
        .then(() => networksLib.gotoNodeNetworkSubTab('test'))
        .assertElementsExist(rowRangeSelector, 2, 'Correct number of IP ranges exists')
        .assertElementPropertyEquals(ipStartSelector, 'placeholder', defaultPlaceholder,
          '"test" group Public new "Start IP Range" textfield has default placeholder')
        .assertElementPropertyEquals(ipEndSelector, 'placeholder', defaultPlaceholder,
          '"test" group Public new "End IP Range" textfield has default placeholder')
        .then(() => networksLib.cancelChanges())
        .then(() => networksLib.checkNetworkInitialState(networkName))
        .then(() => networksLib.gotoNodeNetworkSubTab('default'))
        .then(() => networksLib.checkNetworkInitialState(networkName));
    },
    'Deletion of several node network groups one after another'() {
      this.timeout = 60000;
      var explanationSelector = '.network-group-name .explanation';
      return this.remote
        .then(() => networksLib.deleteNetworkGroup('+-934847fdjfjdbh'))
        .then(() => networksLib.deleteNetworkGroup('yrter'))
        .then(() => networksLib.deleteNetworkGroup('1234'))
        .then(() => networksLib.selectAllNetworksCheckbox(true))
        .then(() => networksLib.deleteNetworkGroup('abc'))
        .then(() => networksLib.checkMergedNetworksGrouping(['default', 'test']))
        .then(() => networksLib.selectAllNetworksCheckbox(false))
        .then(() => command.refresh())
        .assertElementsAppear(explanationSelector, 5000, 'Page refreshed successfully')
        .then(() => networksLib.checkNetworksGrouping(['default', 'test']))
        .assertElementNotContainsText(networkGroupsSelector, '+-934847fdjfjdbh',
          'Network group deleted successfully')
        .assertElementNotContainsText(networkGroupsSelector, 'yrter',
          'Network group deleted successfully')
        .assertElementNotContainsText(networkGroupsSelector, '1234',
          'Network group deleted successfully')
        .assertElementNotContainsText(networkGroupsSelector, 'abc',
          'Network group deleted successfully')
        .then(() => networksLib.deleteNetworkGroup('test'))
        .then(() => command.refresh())
        .assertElementsAppear(explanationSelector, 5000, 'Page refreshed successfully')
        .assertElementNotContainsText(networkGroupsSelector, 'test',
          'Deletion of several node network groups one after another is successfull');
    },
    'Can not create node network group without saving changes'() {
      var errorTextSelector = 'div.text-error';
      var ipRangeStart = '172.16.0.25';
      return this.remote
        .assertElementEnabled(startIpSelector, 'Public "Start IP Range" textfield is enabled')
        .setInputValue(startIpSelector, ipRangeStart)
        .assertElementAppears('button.add-nodegroup-btn i.glyphicon-danger-sign', 1000,
          'Error icon appears')
        .assertElementEnabled(addGroupSelector, '"Add New Node Network Group" button is enabled')
        .clickByCssSelector(addGroupSelector)
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Node Network Group Creation Error'))
        .assertElementDisplayed(errorTextSelector, 'Error message exists')
        .assertElementContainsText(errorTextSelector,
          'It is necessary to save changes before creating a new node network group',
          'True error message presents')
        .then(() => modal.close())
        .then(() => networksLib.cancelChanges());
    },
    'Switching between node network groups without saved changes'() {
      var modalSelector = 'div.modal-dialog';
      var group1Name = 'Network_Group_1';
      var group2Name = 'Network_Group_2';
      var startIpChanged = '172.16.0.26';
      var startIpDefault = '172.16.0.2';
      return this.remote
        .then(() => networksLib.createNetworkGroup(group1Name))
        .then(() => networksLib.createNetworkGroup(group2Name))
        .assertElementEnabled(startIpSelector, 'Public "Start IP Range" textfield is enabled')
        .setInputValue(startIpSelector, startIpChanged)
        .assertElementEnabled(btnSaveSelector,
          '"Save Settings" button is enabled for ' + group2Name)
        .then(() => networksLib.gotoNodeNetworkSubTab(group1Name))
        .assertElementNotExists(modalSelector, 'No new dialogs appear for ' + group1Name)
        .assertElementNotExists(errorSelector, 'No errors are observed for ' + group1Name)
        .assertElementPropertyEquals(startIpSelector, 'value', startIpDefault,
          'Public "Start IP Range" textfield  has default value for ' + group1Name)
        .assertElementEnabled(btnSaveSelector,
          '"Save Settings" button is enabled for ' + group1Name)
        .then(() => networksLib.gotoNodeNetworkSubTab('default'))
        .assertElementNotExists(modalSelector,
          'No new dialogs appear for "default" node network group')
        .assertElementNotExists(errorSelector,
          'No errors are observed for "default" node network group')
        .assertElementPropertyEquals(startIpSelector, 'value', startIpDefault,
          'Public "Start IP Range" textfield  has default value for "default" node network group')
        .assertElementEnabled(btnSaveSelector,
          '"Save Settings" button is enabled for "default" node network group')
        .then(() => networksLib.gotoNodeNetworkSubTab(group2Name))
        .assertElementNotExists(modalSelector, 'No new dialogs appear for ' + group2Name)
        .assertElementNotExists(errorSelector, 'No errors are observed for ' + group2Name)
        .assertElementPropertyEquals(startIpSelector, 'value', startIpChanged,
          'Public "Start IP Range" textfield  has changed value')
        .assertElementEnabled(btnSaveSelector, '"Save Settings" button is enabled')
        .then(() => networksLib.cancelChanges());
    },
    'The same VLAN for different node network groups'() {
      return this.remote
        .then(() => networksLib.gotoNodeNetworkSubTab('Network_Group_1'))
        .then(() => networksLib.checkGateways('Network_Group_1', 'TUN'))
        .then(() => networksLib.checkVLANs('Network_Group_1', 'TUN'))
        .then(() => networksLib.gotoNodeNetworkSubTab('Network_Group_2'))
        .then(() => networksLib.checkVLANs('Network_Group_2', 'TUN'))
        .then(() => networksLib.gotoNodeNetworkSubTab('default'))
        .then(() => networksLib.checkVLANs('default', 'TUN'));
    },
    'Gateways appear for two or more node network groups'() {
      return this.remote
        .then(() => networksLib.gotoNodeNetworkSubTab('Network_Group_2'))
        .then(() => networksLib.checkGateways('Network_Group_2', 'TUN'))
        .then(() => networksLib.gotoNodeNetworkSubTab('Network_Group_1'))
        .then(() => networksLib.checkGateways('Network_Group_1', 'TUN'))
        .then(() => networksLib.gotoNodeNetworkSubTab('default'))
        .then(() => networksLib.checkGateways('default', 'TUN'))
        .then(() => networksLib.gotoNodeNetworkSubTab('Network_Group_1'))
        .then(() => networksLib.deleteNetworkGroup('Network_Group_1'))
        .then(() => networksLib.checkDefaultNetGroup())
        .then(() => networksLib.checkGateways('default', 'TUN'))
        .assertElementEnabled(gatewaySelector,
          'Public "Gateway" field exists and enabled for "default" network group');
    },
    'Validation between default and non-default groups'() {
      var networkAlertSelector = 'div.network-alert';
      var cidrValue = '192.168.12.0/24';
      var ipRangeStart = '192.168.12.2';
      var ipRangeEnd = '192.168.12.254';
      var gatewayArray = '192.168.12.1';
      return this.remote
        .then(() => networksLib.gotoNodeNetworkSubTab('default'))
        .assertElementEnabled('div.management  div.cidr input[type="text"]',
          'Management  "CIDR" textfield is enabled')
        .setInputValue('div.management div.cidr input[type="text"]', cidrValue)
        .assertElementPropertyEquals('div.management div.ip_ranges input[name*="range-start"]',
          'value', ipRangeStart, 'Management "Start IP Range" textfield  has true value')
        .assertElementPropertyEquals('div.management div.ip_ranges input[name*="range-end"]',
          'value', ipRangeEnd, 'Management "End IP Range" textfield has true value')
        .assertElementPropertyEquals('div.management input[name="gateway"]',
          'value', gatewayArray, 'Management "Gateway" textfield has true value')
        .then(() => networksLib.saveSettings())
        .then(() => networksLib.gotoNodeNetworkSubTab('Network_Group_2'))
        .assertElementEnabled('div.storage  div.cidr input[type="text"]',
          'Storage  "CIDR" textfield is enabled')
        .setInputValue('div.storage div.cidr input[type="text"]', cidrValue)
        .assertElementPropertyEquals('div.storage div.ip_ranges input[name*="range-start"]',
          'value', ipRangeStart, 'Storage "Start IP Range" textfield  has true value')
        .assertElementPropertyEquals('div.storage div.ip_ranges input[name*="range-end"]',
          'value', ipRangeEnd, 'Storage "End IP Range" textfield has true value')
        .assertElementPropertyEquals('div.storage input[name="gateway"]',
          'value', gatewayArray, 'Storage "Gateway" textfield has true value')
        .assertElementEnabled(btnSaveSelector, '"Save Settings" button is enabled')
        .clickByCssSelector(btnSaveSelector)
        .assertElementExists(networkAlertSelector, 'Error message is observed')
        .assertElementContainsText(networkAlertSelector,
          'Address space intersection between networks', 'True error message is displayed')
        .assertElementContainsText(networkAlertSelector, 'management',
          'True error message is displayed')
        .assertElementContainsText(networkAlertSelector, 'storage',
          'True error message is displayed')
        .then(() => networksLib.cancelChanges());
    },
    'Validation Floating IP range with non-default group with other CIDR'() {
      var endIpSelector = ipRangesSelector + 'input[name*="range-end"] ';
      var cidrArray = ['172.16.5.0/24', '172.16.6.0/24', '172.16.7.0/24'];
      var ipRangeStart = ['172.16.5.2', '172.16.5.130'];
      var ipRangeEnd = ['172.16.5.126', '172.16.5.254'];
      var gatewayValue = '172.16.5.1';
      return this.remote
        .then(() => networksLib.gotoNodeNetworkSubTab('Network_Group_2'))
        .assertElementEnabled('div.public div.cidr input[type="text"]',
          'Public "CIDR" textfield is enabled')
        .setInputValue('div.public div.cidr input[type="text"]', cidrArray[0])
        .assertElementEnabled(startIpSelector,
          'Public "Start IP Range" textfield is enabled')
        .setInputValue(startIpSelector, ipRangeStart[0])
        .assertElementEnabled(endIpSelector, 'Public "End IP Range" textfield is enabled')
        .setInputValue(endIpSelector, ipRangeEnd[0])
        .assertElementEnabled(gatewaySelector,
          'Public "Gateway" textfield is enabled')
        .setInputValue(gatewaySelector, gatewayValue)
        .assertElementEnabled('div.storage div.cidr input[type="text"]',
          'Storage "CIDR" textfield is enabled')
        .setInputValue('div.storage div.cidr input[type="text"]', cidrArray[1])
        .assertElementEnabled('div.management  div.cidr input[type="text"]',
          'Management "CIDR" textfield is enabled')
        .setInputValue('div.management div.cidr input[type="text"]', cidrArray[2])
        .clickByCssSelector('a.subtab-link-neutron_l3')
        .assertElementEnabled('div.floating_ranges input[name*="start"]',
          'Floating IP ranges "Start" textfield is enabled')
        .setInputValue('div.floating_ranges input[name*="start"]', ipRangeStart[1])
        .assertElementEnabled('div.floating_ranges input[name*="end"]',
          'Floating IP ranges "End" textfield is enabled')
        .setInputValue('div.floating_ranges input[name*="end"]', ipRangeEnd[1])
        .assertElementNotExists(errorSelector, 'No errors are observed')
        .then(() => networksLib.saveSettings());
    },
    'Renaming of Default and non-default network groups'() {
      var newdefaultName = 'new_default';
      var oldName = 'Network_Group_2';
      var reName = 'Network_Group_3';
      var networkNames = [newdefaultName, reName];
      var groupDefaultSelector = 'div[data-name="default"] ';
      var newGroupDefaultSelector = 'div[data-name="' + newdefaultName + '"] ';
      var oldGroupSelector = 'div[data-name="' + oldName + '"] ';
      var newGroupSelector = 'div[data-name="' + reName + '"] ';
      var errorRenameSelector = '.has-error.node-group-renaming ';
      return this.remote
        .then(() => networksLib.selectAllNetworksCheckbox(true))
        // Can rename "default" node network group
        .clickByCssSelector(groupDefaultSelector + pencilSelector)
        .assertElementAppears(groupDefaultSelector + renameSelector, 1000,
          '"default" rename network group textfield appears')
        .findByCssSelector(groupDefaultSelector + renameSelector)
          .clearValue()
          .type(newdefaultName)
          .type('\uE007')
          .end()
        .assertElementsAppear(newGroupDefaultSelector, 1000,
          'New "default": "' + newdefaultName + '"" network group name is shown')
        // Can not rename non-default node network group to "default" name
        .clickByCssSelector(oldGroupSelector + pencilSelector)
        .assertElementAppears(oldGroupSelector + renameSelector, 1000,
          '"' + oldName + '" node network group renaming control exists')
        .findByCssSelector(oldGroupSelector + renameSelector)
          .clearValue()
          .type(newdefaultName)
          .type('\uE007')
          .end()
        .assertElementAppears(errorRenameSelector, 1000,
          'Error is displayed in case of duplicate name')
        .assertElementContainsText(errorRenameSelector + 'span.help-block',
          'This node network group name is already taken', 'True error message presents')
        // Rename non-default node network group
        .findByCssSelector(oldGroupSelector + renameSelector)
          .clearValue()
          .type(reName)
          .type('\uE007')
          .end()
        .assertElementsAppear(newGroupSelector, 1000,
          'New "' + reName + '"" network group name is shown')
        // Postcondition check
        .then(() => networksLib.checkMergedNetworksGrouping(networkNames))
        .then(() => networksLib.selectAllNetworksCheckbox(false))
        .then(() => networksLib.checkNetworksGrouping(networkNames));
    },
    'Correct bahaviour of long name for node network group'() {
      var oldName = 'Network_Group_3';
      var newName = 'fgbhsjdkgbhsdjkbhsdjkbhfjkbhfbjhgjbhsfjgbhsfjgbhsg';
      var activeSelector = networkGroupsSelector + ' li.active';
      return this.remote
        .then(() => networksLib.gotoNodeNetworkSubTab(oldName))
        .assertElementTextEquals(activeSelector, oldName,
          oldName + ' node network group is selected')
        .assertElementPropertyEquals(activeSelector, 'offsetHeight', '37',
          oldName + ' node network group has default height')
        .assertElementPropertyEquals(activeSelector, 'offsetWidth', '163',
          oldName + ' node network group has default width')
        .clickByCssSelector(pencilSelector)
        .assertElementAppears(renameSelector, 1000, 'Node network group Rename textfield appears')
        .findByCssSelector(renameSelector)
          .clearValue()
          .type(newName)
          .type('\uE007')
          .end()
        .assertElementTextEquals(activeSelector, newName,
          'New node network group ' + newName + ' is shown and selected')
        .assertElementTextEquals(nameSelector, newName,
          'New node network group name "link" is shown')
        .assertElementPropertyEquals(activeSelector, 'offsetHeight', '87',
          'Renamed node network group has correct height')
        .assertElementPropertyEquals(activeSelector, 'offsetWidth', '163',
          'Renamed node network group has correct width');
    },
    'User can add and rename new node network group after deployment'() {
      this.timeout = 60000;
      var newName = 'Network_Group_1';
      var reName = 'Network_Group_2';
      var netNames = ['new_default', 'fgbhsjdkgbhsdjkbhsdjkbhfjkbhfbjhgjbhsfjgbhsfjgbhsg', reName];
      var progressSelector = '.dashboard-block .progress';
      var groupSelector = 'div[data-name="' + newName + '"] ';
      var newGroupSelector = 'div[data-name="' + reName + '"] ';
      return this.remote
        // Precondition
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardPage.startDeployment())
        .assertElementsAppear(progressSelector, 5000, 'Deployment is started')
        .assertElementDisappears(progressSelector, 30000, 'Deployment is finished')
        .then(() => clusterPage.goToTab('Networks'))
        .then(() => networksLib.selectAllNetworksCheckbox(true))
        // Can add new node network group after deployment
        .then(() => networksLib.createNetworkGroup(newName))
        // Can rename new node network group after deployment
        .assertElementsAppear(groupSelector + pencilSelector, 1000, '"Pencil" icon appears')
        .clickByCssSelector(groupSelector + pencilSelector)
        .assertElementAppears(groupSelector + renameSelector, 1000,
          'Node network group renaming control appears')
        .findByCssSelector(groupSelector + renameSelector)
          .clearValue()
          .type(reName)
          .type('\uE007')
          .end()
        .assertElementsAppear(newGroupSelector, 1000, 'New network group name is shown')
        // Postcondition check
        .then(() => networksLib.checkMergedNetworksGrouping(netNames))
        .then(() => networksLib.selectAllNetworksCheckbox(false))
        .then(() => networksLib.checkNetworksGrouping(netNames));
    }
  };
});
