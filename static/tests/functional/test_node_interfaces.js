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
import pollUntil from 'intern/dojo/node!leadfoot/helpers/pollUntil';
import InterfacesPage from 'tests/functional/pages/interfaces';
import Common from 'tests/functional/pages/common';
import 'tests/functional/helpers';

registerSuite(() => {
  var common,
    interfacesPage,
    clusterName;

  return {
    name: 'Node Interfaces',
    setup() {
      common = new Common(this.remote);
      interfacesPage = new InterfacesPage(this.remote);
      clusterName = common.pickRandomName('Test Cluster');
      this.skip('Interfaces get rid');
      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName))
        .then(() => common.addNodesToCluster(1, 'Controller', null, 'Supermicro X9SCD'))
        .clickByCssSelector('.node.pending_addition input[type=checkbox]:not(:checked)')
        .clickByCssSelector('button.btn-configure-interfaces')
        .assertElementAppears('div.ifc-list', 2000, 'Node interfaces loaded')
        .then(
          pollUntil(
            () => window.$('div.ifc-list').is(':visible') || null,
            1000
          )
        );
    },
    afterEach() {
      return this.remote
        .clickByCssSelector('.btn-defaults')
        .waitForCssSelector('.btn-defaults:enabled', 2000);
    },
    teardown() {
      return this.remote
        .then(() => common.removeCluster(clusterName, true));
    },
    'Configure interface properties manipulations'() {
      return this.remote
        .clickByCssSelector('.mtu .btn-link')
        .assertElementExists(
          '.mtu-control',
          'MTU control is shown when navigating to MTU tab'
        )
        .setInputValue('.mtu-control input', '2')
        .assertElementExists(
          '.has-error.mtu-control',
          'Error styles are applied to MTU control on invalid value'
        )
        .assertElementExists(
          '.text-danger.mtu',
          'Invalid style is applied to MTU in summary panel'
        )
        .setInputValue('.mtu-control input', '256')
        .assertElementExists(
          '.ifc-inner-container.has-changes',
          'Has-Changes style is applied'
        )
        .clickByCssSelector('.mtu .btn-link')
        .sleep(500)
        .assertElementNotDisplayed(
          '.mtu-control',
          'MTU control is hidden after clicking MTU link again'
        );
    },
    'Untagged networks error'() {
      return this.remote
        .then(() => interfacesPage.assignNetworkToInterface('Public', 'eth0'))
        .assertElementExists('div.ifc-error',
          'Untagged networks can not be assigned to the same interface message should appear');
    },
    'Bond interfaces with different speeds'() {
      return this.remote
        .then(() => interfacesPage.selectInterface('eth2'))
        .then(() => interfacesPage.selectInterface('eth3'))
        .assertElementExists('div.alert.alert-warning',
          'Interfaces with different speeds bonding not recommended message should appear')
        .assertElementEnabled('.btn-bond', 'Bonding button should still be enabled');
    },
    'Interfaces bonding'() {
      return this.remote
        .then(() => interfacesPage.bondInterfaces('eth1', 'eth2'))
        .then(() => interfacesPage.checkBondInterfaces('bond0', ['eth1', 'eth2']))
        .then(() => interfacesPage.bondInterfaces('bond0', 'eth5'))
        // Adding interface to existing bond
        .then(() => interfacesPage.checkBondInterfaces('bond0', ['eth1', 'eth2', 'eth5']))
        .then(() => interfacesPage.removeInterfaceFromBond('bond0', 'eth2'))
        // Removing interface from the bond
        .then(() => interfacesPage.checkBondInterfaces('bond0', ['eth1', 'eth5']));
    },
    'Interfaces unbonding'() {
      return this.remote
        .then(() => interfacesPage.bondInterfaces('eth1', 'eth2'))
        // Two interfaces bondin
        .then(() => interfacesPage.selectInterface('bond0'))
        .clickByCssSelector('.btn-unbond')
        .then(() => interfacesPage.selectInterface('eth1'))
        .then(() => interfacesPage.selectInterface('eth2'));
    },
    'Check that two bonds cannot be bonded'() {
      return this.remote
        .then(() => interfacesPage.bondInterfaces('eth0', 'eth2'))
        .then(() => interfacesPage.bondInterfaces('eth1', 'eth5'))
        .then(() => interfacesPage.selectInterface('bond0'))
        .then(() => interfacesPage.selectInterface('bond1'))
        .assertElementDisabled('.btn-bond', 'Making sure bond button is disabled')
        .assertElementContainsText('.alert.alert-warning',
          ' network interface is already bonded with other network interfaces.',
          'Warning message should appear when intended to bond bonds');
    },
    'Interface bonding Modes'() {
      return this.remote
        .then(() => interfacesPage.bondInterfaces('eth1', 'eth2'))
        .then(() => interfacesPage.checkBondMode('bond0', 'active-backup'))
        .then(() => interfacesPage.checkBondMode('bond0', '802.3ad'))
        .then(() => interfacesPage.bondInterfaces('eth0', 'eth3'))
        .then(() => interfacesPage.checkBondMode('bond1', 'active-backup'))
        .then(() => interfacesPage.checkBondMode('bond0', 'balance-rr'));
    }
  };
});
