/*
 * Copyright 2015 Mirantis, Inc.
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
import assert from 'intern/chai!assert';
import Common from 'tests/functional/pages/common';
import ClusterPage from 'tests/functional/pages/cluster';
import DashboardPage from 'tests/functional/pages/dashboard';
import NetworkPage from 'tests/functional/pages/network';

registerSuite(() => {
  var common,
    clusterPage,
    dashboardPage,
    networkPage;
  var applyButtonSelector = '.apply-btn';
  return {
    name: 'Networks page Neutron tests',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      dashboardPage = new DashboardPage(this.remote);
      networkPage = new NetworkPage(this.remote);
      return this.remote
        .then(() => common.getIn())
        .then(
          () => common.createCluster(
            'Test Cluster #1',
            {
              'Networking Setup'() {
                return this.remote
                  .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:vlan]')
                  .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:tun]');
              }
            }
          )
        )
        .then(() => clusterPage.goToTab('Networks'));
    },
    afterEach() {
      return this.remote
        .findByCssSelector('.btn-revert-changes')
          .then(
            (element) => element.isEnabled()
              .then((isEnabled) => !isEnabled || element.click())
          )
          .end();
    },
    'Network Tab is rendered correctly'() {
      return this.remote
        .assertElementsExist('.network-tab h3', 4, 'All networks are present')
        .getCurrentUrl()
          .then((url) => {
            assert.include(
              url,
              'network/group/1',
              'Subtab url exists in the page location string'
            );
          })
        .assertElementsExist('.popover-container i', 'Networking info icons presented')
        .findByCssSelector('.public .popover-container i')
          .then((element) => this.remote.moveMouseTo(element))
          .end()
        .assertElementAppears('.requirements-popover', 1000, 'Networking help popover is shown')
        .clickLinkByText('Neutron L2')
        .getCurrentUrl()
          .then((url) => assert.include(url, 'neutron_l2', 'Networks tab subtabs are routable'))
        .findByCssSelector('ul.node_network_groups')
          .clickLinkByText('default')
          .end();
    },
    'Testing cluster networks: Save button interactions'() {
      var cidrInitialValue;
      var cidrElementSelector = '.storage input[name=cidr]';
      return this.remote
        .findByCssSelector(cidrElementSelector)
        .then(
          (element) => element.getProperty('value')
            .then((value) => {
              cidrInitialValue = value;
            })
        )
        .end()
        .setInputValue(cidrElementSelector, '240.0.1.0/25')
        .assertElementAppears(applyButtonSelector + ':not(:disabled)', 200,
          'Save changes button is enabled if there are changes')
        .then(() => this.remote.setInputValue(cidrElementSelector, cidrInitialValue))
        .assertElementAppears(applyButtonSelector + ':disabled', 200,
          'Save changes button is disabled again if there are no changes');
    },
    'Testing cluster networks: network notation change'() {
      return this.remote
        .then(() => networkPage.goToNodeNetworkGroup('default'))
        .assertElementAppears('.storage', 2000, 'Storage network is shown')
        .assertElementSelected('.storage .cidr input[type=checkbox]',
          'Storage network has "cidr" notation by default')
        .assertElementNotExists('.storage .ip_ranges input[type=text]:not(:disabled)',
          'It is impossible to configure IP ranges for network with "cidr" notation')
        .clickByCssSelector('.storage .cidr input[type=checkbox]')
        .assertElementNotExists('.storage .ip_ranges input[type=text]:disabled',
          'Network notation was changed to "ip_ranges"');
    },
    'Testing cluster networks: save network changes'() {
      var cidrElementSelector = '.storage .cidr input[type=text]';
      return this.remote
        .setInputValue(cidrElementSelector, '192.168.1.0/26')
        .clickByCssSelector(applyButtonSelector)
        .assertElementsAppear('input:not(:disabled)', 2000, 'Inputs are not disabled')
        .assertElementNotExists('.alert-error', 'Correct settings were saved successfully')
        .assertElementDisabled(applyButtonSelector,
          'Save changes button is disabled again after successful settings saving');
    },
    'Testing cluster networks: verification'() {
      this.timeout = 100000;
      return this.remote
        .clickByCssSelector('.subtab-link-network_verification')
        .assertElementDisabled('.verify-networks-btn',
          'Verification button is disabled in case of no nodes')
        .assertElementTextEquals('.alert-warning',
          'At least two online nodes are required to verify environment network configuration',
          'Not enough nodes warning is shown')
        .then(() => networkPage.goToNodeNetworkGroup('default'))
        .then(() => common.addNodesToCluster(2, ['Controller']))
        .then(() => clusterPage.goToTab('Networks'))
        .setInputValue('.public input[name=gateway]', '172.16.0.2')
        .clickByCssSelector('.subtab-link-network_verification')
        .clickByCssSelector('.verify-networks-btn')
        .assertElementAppears('.alert-danger.network-alert', 4000, 'Verification error is shown')
        .assertElementAppears('.alert-danger.network-alert', 'Address intersection',
          'Verification result is shown in case of address intersection')
        // Testing cluster networks: verification task deletion
        .then(() => networkPage.goToNodeNetworkGroup('default'))
        .setInputValue('.public input[name=gateway]', '172.16.0.5')
        .clickByCssSelector('.subtab-link-network_verification')
        .assertElementNotExists('.page-control-box .alert',
          'Verification task was removed after settings has been changed')
        .clickByCssSelector('.btn-revert-changes')
        .clickByCssSelector('.verify-networks-btn')
        .waitForElementDeletion('.animation-box .success.connect-1', 6000)
        .assertElementAppears('.alert-success', 10000, 'Success verification message appears')
        .assertElementContainsText(
          '.alert-success',
          'Verification succeeded',
          'Success verification message appears with proper text'
        )
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardPage.discardChanges())
        .then(() => clusterPage.goToTab('Networks'));
    },
    'Check VlanID field validation'() {
      return this.remote
        .then(() => networkPage.goToNodeNetworkGroup('default'))
        .assertElementAppears('.management', 2000, 'Management network appears')
        .clickByCssSelector('.management .vlan-tagging input[type=checkbox]')
        .clickByCssSelector('.management .vlan-tagging input[type=checkbox]')
        .assertElementExists('.management .has-error input[name=vlan_start]',
          'Field validation has worked properly in case of empty value');
    },
    'Testing cluster networks: data validation on invalid settings'() {
      return this.remote
        .then(() => networkPage.goToNodeNetworkGroup('default'))
        .setInputValue('.public input[name=cidr]', 'blablabla')
        .assertElementAppears('.public .has-error input[name=cidr]', 1000,
          'Error class style is applied to invalid input field')
        .assertElementsExist(
          '#network-subtabs i.glyphicon-danger-sign',
          2,
          'Warning tab icons appear for public network and floating ranges setting')
        .assertElementExists('.add-nodegroup-btn .glyphicon-danger-sign', 1000,
          'Warning icon for Add Node Network Group appears')
        .clickByCssSelector('.btn-revert-changes')
        .waitForElementDeletion('.alert-danger.network-alert', 1000)
        .assertElementNotExists('#network-subtabs i.glyphicon-danger-sign',
          'Warning tab icon disappears')
        .assertElementNotExists('.public .has-error input[name=cidr]', 1000,
          'Error class style is removed after reverting changes')
        .assertElementNotExists('.add-nodegroup-btn .glyphicon-danger-sign', 1000,
          'Warning icon for Add Node Network Group disappears');
    },
    'Add ranges manipulations'() {
      var rangeSelector = '.public .ip_ranges ';
      return this.remote
        .clickByCssSelector(rangeSelector + '.ip-ranges-add')
        .assertElementsExist(rangeSelector + '.ip-ranges-delete', 2,
          'Remove ranges controls appear')
        .clickByCssSelector(applyButtonSelector)
        .assertElementsExist(rangeSelector + '.range-row',
          'Empty range row is removed after saving changes')
        .assertElementNotExists(rangeSelector + '.ip-ranges-delete',
          'Remove button is absent for only one range');
    },
    'Segmentation types differences'() {
      return this.remote
        .then(() => networkPage.goToNodeNetworkGroup('default'))
        // Tunneling segmentation tests
        .assertElementExists('.private',
          'Private Network is visible for tunneling segmentation type')
        .assertElementTextEquals('.segmentation-type', '(Neutron with tunneling segmentation)',
          'Segmentation type is correct for tunneling segmentation')
        // Vlan segmentation tests
        .clickLinkByText('Environments')
        .then(() => common.createCluster('Test vlan segmentation'))
        .then(() => clusterPage.goToTab('Networks'))
        .assertElementNotExists('.private',
          'Private Network is not visible for vlan segmentation type')
        .assertElementTextEquals('.segmentation-type', '(Neutron with VLAN segmentation)',
          'Segmentation type is correct for VLAN segmentation');
    },
    'Other settings validation error'() {
      return this.remote
        .clickByCssSelector('.subtab-link-network_settings')
        .setInputValue('input[name=dns_list]', 'blablabla')
        .assertElementAppears('.subtab-link-network_settings .glyphicon-danger-sign', 2000,
          'Warning icon for "Other" section appears');
    }
  };
});
