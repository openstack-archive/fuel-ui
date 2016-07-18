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
import GenericNetworksLib from 'tests/functional/nightly/library/networks_generic';
import NetworksLib from 'tests/functional/nightly/library/networks';

registerSuite(() => {
  var common, clusterPage, clusterName, networksLib, storageNetwork, publicNetwork,
    managementNetwork;

  return {
    name: 'Neutron VLAN segmentation',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      networksLib = new GenericNetworksLib(this.remote);
      publicNetwork = new NetworksLib(this.remote, 'public');
      storageNetwork = new NetworksLib(this.remote, 'storage');
      managementNetwork = new NetworksLib(this.remote, 'management');
      clusterName = common.pickRandomName('VLAN Cluster');

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName))
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => common.addNodesToCluster(1, ['Compute']))
        .then(() => clusterPage.goToTab('Settings'));
    },
    'Check no network settings on "Settings" tab'() {
      return this.remote
        .assertElementExists('div.settings-tab div.general', '"Settings" tab is not empty')
        .assertElementNotExists('div.network-tab div.network-tab-content',
          '"Network" segment is not presented on "Settings" tab')
        .assertElementEnabled('button.btn-load-defaults', 'Load defaults button is enabled')
        .assertElementDisabled('button.btn-revert-changes', 'Cancel Changes button is disabled')
        .assertElementDisabled('button.btn-apply-changes', 'Save Settings button is disabled');
    },
    'User returns to the selected segment on "Networks" tab'() {
      return this.remote
        .then(() => clusterPage.goToTab('Networks'))
        .assertElementExists('a[class*="network"][class*="active"]', '"Networks" tab is opened')
        .assertElementExists('div.network-tab div.network-tab-content',
          '"Networks" tab is not empty')
        .assertElementTextEquals('ul.node_network_groups li.group-title',
          'Node Network Groups', '"Node Network Groups" segment opens by default')
        .assertElementTextEquals('ul.node_network_groups li.active', 'default',
          '"default" node network group opens by default')
        .clickByCssSelector('.subtab-link-neutron_l2')
        .assertElementExists('li.active a.subtab-link-neutron_l2',
          '"Neutron L2" subtab is selected')
        .assertElementTextEquals('h3.networks', 'Neutron L2 Configuration',
          '"Neutron L2" subtab is opened')
        .then(() => clusterPage.goToTab('Nodes'))
        .assertElementExists('a[class*="nodes"][class*="active"]', '"Nodes" tab is opened')
        .then(() => clusterPage.goToTab('Networks'))
        .assertElementExists('a[class*="network"][class*="active"]', '"Networks" tab is opened')
        .assertElementExists('li.active a.subtab-link-neutron_l2',
          '"Neutron L2" subtab is selected')
        .assertElementTextEquals('h3.networks', 'Neutron L2 Configuration',
          '"Neutron L2" subtab is opened');
    },
    'Check "Node Network Groups" segment on "Networks" tab'() {
      return this.remote
        .then(() => networksLib.goToNodeNetworkSubTab('default'))
        .then(() => publicNetwork.checkNetworkInitialState())
        .then(() => storageNetwork.checkNetworkInitialState())
        .then(() => managementNetwork.checkNetworkInitialState());
    },
    'Check "Settings" segment on "Networks" tab'() {
      return this.remote
        .then(() => networksLib.checkNetworkSettingsSegment('VLAN'));
    },
    'Check "Network Verification" segment on "Networks" tab'() {
      return this.remote
        .then(() => networksLib.checkNetworkVerificationSegment());
    },
    'Success network verification exists only on "Network Verification" segment'() {
      return this.remote
        .clickByCssSelector('.subtab-link-network_verification')
        .assertElementEnabled('.verify-networks-btn', '"Verify Networks" is enabled')
        .clickByCssSelector('.verify-networks-btn')
        .assertElementAppears('div.alert-success', 15000,
          'Verification success is shown on "Connectivity Check" subtab')
        .assertElementContainsText('div.alert-success', 'Verification succeeded',
          'True message is observed')
        .assertElementContainsText('div.alert-success', 'Your network is configured correctly',
          'True msg observed')
        .then(() => networksLib.goToNodeNetworkSubTab('default'))
        .assertElementNotExists('div.alert-success',
          'No message about result of network verification on "default" subtab')
        .clickByCssSelector('.subtab-link-neutron_l2')
        .assertElementNotExists('div.alert-success',
          'No message about result of network verification on "Neutron L2" subtab')
        .clickByCssSelector('.subtab-link-neutron_l3')
        .assertElementNotExists('div.alert-success',
          'No message about result of network verification on "Neutron L3" subtab')
        .clickByCssSelector('.subtab-link-network_settings')
        .assertElementNotExists('div.alert-success',
          'No message about result of network verification on "Other" subtab')
        .clickByCssSelector('.subtab-link-network_verification')
        .assertElementExists('div.alert-success',
          'Verification success is again observed on "Connectivity Check" subtab')
        .assertElementContainsText('div.alert-success', 'Verification succeeded',
          'True message is observed')
        .assertElementContainsText('div.alert-success', 'Your network is configured correctly',
          'True msg observed');
    },
    'Failed network verification presents on each subtab on "Networks" tab'() {
      var gatewayValue = '172.16.0.2';
      return this.remote
        .then(() => networksLib.goToNodeNetworkSubTab('default'))
        .setInputValue('div.public input[name=gateway]', gatewayValue)
        .clickByCssSelector('.subtab-link-network_verification')
        .assertElementEnabled('.verify-networks-btn', '"Verify Networks" is enabled')
        .clickByCssSelector('.verify-networks-btn')
        .assertElementAppears('div.alert-danger', 5000,
          'Verification failed is shown on "Connectivity Check" subtab')
        .assertElementContainsText('div.alert-danger',
          'Address intersection between public gateway and IP range of public network',
          'True message is observed')
        .then(() => networksLib.goToNodeNetworkSubTab('default'))
        .assertElementExists('div.alert-danger',
          'Message about result of network verification on "default" subtab')
        .assertElementContainsText('div.alert-danger',
          'Address intersection between public gateway and IP range of public network',
          'True message is observed')
        .clickByCssSelector('.subtab-link-neutron_l2')
        .assertElementExists('div.alert-danger',
          'Message about result of network verification on "default" subtab')
        .assertElementContainsText('div.alert-danger',
          'Address intersection between public gateway and IP range of public network',
          'True message is observed')
        .clickByCssSelector('.subtab-link-neutron_l3')
        .assertElementExists('div.alert-danger',
          'Message about result of network verification on "default" subtab')
        .assertElementContainsText('div.alert-danger',
          'Address intersection between public gateway and IP range of public network',
          'True message is observed')
        .clickByCssSelector('.subtab-link-network_settings')
        .assertElementExists('div.alert-danger',
          'Message about result of network verification on "default" subtab')
        .assertElementContainsText('div.alert-danger',
          'Address intersection between public gateway and IP range of public network',
          'True message is observed')
        .clickByCssSelector('.subtab-link-network_verification')
        .assertElementExists('div.alert-danger',
          'Message about result of network verification on "default" subtab')
        .assertElementContainsText('div.alert-danger',
          'Address intersection between public gateway and IP range of public network',
          'True message is observed');
    }
  };
});

registerSuite(() => {
  var common, clusterPage, clusterName, networksLib, storageNetwork, publicNetwork,
    managementNetwork, privateNetwork;

  return {
    name: 'Neutron tunneling segmentation',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      clusterName = common.pickRandomName('Tunneling Cluster');
      networksLib = new GenericNetworksLib(this.remote);
      publicNetwork = new NetworksLib(this.remote, 'public');
      storageNetwork = new NetworksLib(this.remote, 'storage');
      managementNetwork = new NetworksLib(this.remote, 'management');
      privateNetwork = new NetworksLib(this.remote, 'private');

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName,
          {
            'Networking Setup'() {
              return this.remote
                .clickByCssSelector('input[value*="neutron"][value$=":vlan"]')
                .clickByCssSelector('input[value*="neutron"][value$=":tun"]');
            }
          }
        ))
        .then(() => clusterPage.goToTab('Networks'));
    },
    'Check "Node Network Groups" segment on "Networks" tab'() {
      return this.remote
        .assertElementExists('a[class*="network"][class*="active"]', '"Networks" tab is opened')
        .assertElementExists('div.network-tab div.network-tab-content',
          '"Networks" tab is not empty')
        .assertElementTextEquals('ul.node_network_groups li.group-title',
          'Node Network Groups', '"Node Network Groups" segment opens by default')
        .assertElementTextEquals('ul.node_network_groups li.active', 'default',
          '"default" node network group opens by default')
        .then(() => publicNetwork.checkNetworkInitialState())
        .then(() => storageNetwork.checkNetworkInitialState())
        .then(() => managementNetwork.checkNetworkInitialState())
        .then(() => privateNetwork.checkNetworkInitialState());
    },
    'Check "Settings" segment on "Networks" tab'() {
      return this.remote
        .then(() => networksLib.checkNetworkSettingsSegment('Tunnel'));
    },
    'Check "Network Verification" segment on "Networks" tab'() {
      return this.remote
        .then(() => networksLib.checkNetworkVerificationSegment());
    }
  };
});
