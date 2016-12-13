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
    'Test restrictions'() {
      var smile = 'input[value=additional_service\\:smile]';
      var ml2 = 'input[value=network\\:neutron\\:core\\:ml2]';
      var vlan = 'input[value=network\\:neutron\\:ml2\\:vlan]';

      return this.remote
       .updatePlugin('update_nics nic_restrict')
       .newClusterWithPlugin(modal)

       .then(() => common.addNodesToCluster(1, ['Controller']))

       .configureInterfacesForNode(modal, 1)

       .assertAmountMatches('span.fuel_plugin_example_v5', 'span.mtu',
                            'Amount of plugin\'s attributes does not match with interfaces amount')

       .selectPluginNICPropertyByNumber(modal, 1)

       .clickByCssSelector('input[type="checkbox"][name="attribute_checkbox"]')

       .assertElementTextEquals('span.fuel_plugin_example_v5.active button', 'Enabled',
                                'Checkbox does not enable plugin section')

       .assertElementNotExists('input[type="text"][name="attribute_text_r"]', 'Text-input field is displayed')

       .clickByCssSelector('a.settings.cluster-tab')
       .clickByCssSelector('button.btn-danger.proceed-btn')  // Discard changes
       .then(() => modal.waitToClose())

       .clickByCssSelector('a.subtab-link-compute')
       .clickByCssSelector('input[name="libvirt_type"][value="kvm"]')

       .clickByCssSelector('button.btn-apply-changes')
       .waitForCssSelector('.btn-load-defaults:not(:disabled)', 1000)

       .then(() => clusterPage.goToTab('Nodes'))

       .clickByCssSelector('button.btn-configure-interfaces')

       .selectPluginNICPropertyByNumber(modal, 1)

       .assertElementExists('input[type="checkbox"][name="attribute_checkbox"]', 'Checkbox is not displayed')
       .assertElementExists('input[type="text"][name="attribute_text_r"]', 'Text-input field is not displayed')

       .then(() => clusterPage.goToTab('Dashboard'))

       // Delete created environment
        .deleteCluster(modal)
        .catch(() => modal.close().then(() => modal.waitToClose()));
    },
  };
});
