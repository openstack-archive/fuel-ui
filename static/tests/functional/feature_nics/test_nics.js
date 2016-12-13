/*
 * Copyright 2016 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 **/

import registerSuite from 'intern!object';
import Common from 'tests/functional/pages/common';
import Modal from 'tests/functional/pages/modal';
import ClusterPage from 'tests/functional/pages/cluster';
import 'tests/functional/helpers';
import 'tests/functional/component_registry/component_helpers';

registerSuite(() => {
  var common, modal, clusterPage;

  return {
    name: 'NICs',
    setup() {
      common = new Common(this.remote);
      modal = new Modal(this.remote);
      clusterPage = new ClusterPage(this.remote);

      return this.remote
       .then(() => common.getIn());
    },
    'Set up all attributes'() {
      return this.remote
       .updatePlugin('update_nics nic_setup')
       .updatePlugin('update_nodes node_setup')
       .updatePlugin('update_bonds bond_setup')

       .newClusterWithPlugin(modal)
       .deleteCluster(modal, clusterPage)
    },
    'Test nic attributes'() {
      var nicCheckbox = 'input[type="checkbox"][name="attribute_checkbox"]';
      var nicText = 'input[type="text"][name="attribute_text"]';
      var itfConfigure = 'button.btn-configure-interfaces';

      return this.remote
       .newClusterWithPlugin(modal)

       // Add one node, open interface configuration,
       // verify that plugin's attributes for nics are presented
       .then(() => common.addNodesToCluster(1, ['Controller']))
       .selectNodeByNumber(modal, 1)
       .clickByCssSelector(itfConfigure)
       .assertAmountMatches('span.fuel_plugin_example_v5', 'span.mtu',
                            'Amount of plugin\'s attributes does not match with interfaces amount')

       // Expand attributes of the first interface, verify that checkbox and input are available
       .selectPluginNICPropertyByNumber(modal, 1)
       .assertElementEnabled(nicCheckbox, 'Checkbox is disabled')
       .clickByCssSelector(nicCheckbox)
       .assertElementTextEquals('span.fuel_plugin_example_v5.active button', 'Enabled',
                                'Checkbox does not enable plugin section')
       .assertElementEnabled(nicText, 'Text-input is not available to edit')
       .setInputValue(nicText, 'some_data')

       .assertElementEnabled('button.btn-apply', 'Apply is disabled')
       .clickByCssSelector('button.btn-apply')

       .deleteCluster(modal, clusterPage)
    },
    'Test restrictions'() {
      var nicCheckbox = 'input[type="checkbox"][name="attribute_checkbox"]';
      var nicText = 'input[type="text"][name="attribute_text_r"]';
      var itfConfigure = 'button.btn-configure-interfaces';

      return this.remote
       .updatePlugin('update_nics nic_restrict')
       .newClusterWithPlugin(modal)

       // Add one node, open interface configuration
       .then(() => common.addNodesToCluster(1, ['Controller']))
       .selectNodeByNumber(modal, 1)
       .clickByCssSelector(itfConfigure)

       // Expand attributes of the first interface, verify that checkbox is available
       .selectPluginNICPropertyByNumber(modal, 1)
       .clickByCssSelector(nicCheckbox)

       // Verify that text input is not displayed
       .assertElementNotExists(nicText, 'Text-input field is displayed')

       // Enable KVM
       .clickByCssSelector('a.settings.cluster-tab')
       .clickByCssSelector('button.btn-danger.proceed-btn')  // Discard changes
       .then(() => modal.waitToClose())

       .clickByCssSelector('a.subtab-link-compute')
       .clickByCssSelector('input[name="libvirt_type"][value="kvm"]')

       .clickByCssSelector('button.btn-apply-changes')
       .waitForCssSelector('.btn-load-defaults:not(:disabled)', 1000)

       // Verify that text input is displayed
       .then(() => clusterPage.goToTab('Nodes'))
       .clickByCssSelector(itfConfigure)

       .selectPluginNICPropertyByNumber(modal, 1)

       .assertElementExists(nicCheckbox, 'Checkbox is not displayed')
       .assertElementExists(nicText, 'Text-input field is not displayed')

       .deleteCluster(modal, clusterPage)
    },
  };
});
