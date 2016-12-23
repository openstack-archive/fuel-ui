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
import 'tests/functional/real_plugin/plugin_helpers';

registerSuite(() => {
  var common, modal, clusterPage;

  var nodeCheckbox = 'input[type=checkbox][name="attribute_checkbox"]';
  var nodeText = 'input[type=text][name="attribute_text"]';

  var btnApply = 'button.apply-changes';
  var btnLoadDefaults = '.btn-load-defaults';

  return {
    name: 'Nodes',
    timeout: 3 * 60 * 1000,
    setup() {
      common = new Common(this.remote);
      modal = new Modal(this.remote);
      clusterPage = new ClusterPage(this.remote);

      return this.remote
        .then(() => common.getIn());
    },
    afterEach() {
      return this.remote
        .deleteCluster(modal);
    },
    test_nodes() {  // Test attributes for Nodes
      return this.remote
        .updatePlugin('update_nodes node_setup')
        .newClusterWithPlugin(modal)

        // Add node and open settings for it
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .clickByCssSelector('.node-settings')
        .then(() => modal.waitToOpen())

        // Verify that provided attributes are presented
        .clickByCssSelector('#headingattributes')

        .assertElementExists('.setting-section-plugin_section_a', 'Plugin section is not presented')
        .assertElementExists(nodeCheckbox, 'Checkbox is not presented')
        .assertElementExists(nodeText, 'Input field is not presented')

        .clickByCssSelector(nodeCheckbox)
        .setInputValue(nodeText, 'some_data')

        .assertElementEnabled(btnApply, 'Apply is disabled')
        .clickByCssSelector(btnApply)
        .waitForCssSelector(btnLoadDefaults + ':not(:disabled)', 1000)

        .then(() => modal.close())
        .then(() => modal.waitToClose());
    },
    node_defaults() {  // Test Load defaults for Nodes
      return this.remote
        .newClusterWithPlugin(modal)

        // Add node and open settings for it
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .clickByCssSelector('.node-settings')
        .then(() => modal.waitToOpen())

        // Change default values for attributes provided by plugin and apply the changes
        .clickByCssSelector('#headingattributes')
        .clickByCssSelector(nodeCheckbox)
        .setInputValue(nodeText, 'some_data')
        .clickByCssSelector(btnApply)
        .waitForCssSelector(btnLoadDefaults + ':not(:disabled)', 1000)

        // Load Defaults and verify that default values were loaded
        .clickByCssSelector(btnLoadDefaults)
        .waitForCssSelector(btnLoadDefaults + ':not(:disabled)', 1000)

        .assertInputValueEquals(nodeText, '', 'Text-input is not empty')
        .assertElementExists(nodeCheckbox + ':not(:checked)', 'Checkbox is still checked')

        // Save default values
        .assertElementEnabled(btnApply, 'Apply is disabled')
        .clickByCssSelector(btnApply)
        .waitForCssSelector(btnLoadDefaults + ':not(:disabled)', 1000)

        .then(() => modal.close())
        .then(() => modal.waitToClose());
    },
    node_multiple_plugins() {  // Test several plugins with different Nodes configs
      var nodeCheckboxDVS = 'input[type=checkbox][name="attribute_checkbox_b"]';

      return this.remote
        // Create cluster with plugins
        .newClusterFillName(modal)
        .pressKeys('\uE007') // go to Compute
        .pressKeys('\uE007') // Networking
        .clickByCssSelector('input[name="network:neutron:ml2:dvs"]')
        .pressKeys('\uE007') // Storage
        .pressKeys('\uE007') // Additional Services
        .clickByCssSelector('input[name="additional_service:service_plugin_v5_component"]')
        .pressKeys('\uE007') // Finish
        .pressKeys('\uE007') // Create
        .then(() => modal.waitToClose())

        // Add one node, open settings for it
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .clickByCssSelector('.node-settings')
        .then(() => modal.waitToOpen())
        .clickByCssSelector('#headingattributes')

        // Verify that attributes provided by both of plugins are presented and can be changed
        .setInputValue(nodeText, 'some_data')

        .assertElementEnabled(nodeCheckbox, 'Checkbox is disabled')
        .clickByCssSelector(nodeCheckbox)

        .assertInputValueEquals(nodeText, 'some_data', 'Text-input is empty')

        .assertElementEnabled(nodeCheckboxDVS, 'DVS Checkbox is disabled')
        .clickByCssSelector(nodeCheckboxDVS)

        .assertElementExists(nodeCheckboxDVS + ':checked', 'DVS Checkbox was not checked')

        .assertElementExists(nodeCheckbox + ':checked', 'Checkbox was not checked')

        // Save changes
        .assertElementEnabled(btnApply, 'Apply is disabled')
        .clickByCssSelector(btnApply)
        .waitForCssSelector(btnLoadDefaults + ':not(:disabled)', 1000)

        // Load defaults
        .clickByCssSelector(btnLoadDefaults)
        .waitForCssSelector(btnLoadDefaults + ':not(:disabled)', 1000)

        // Verify that defaults were loaded
        .assertInputValueEquals(nodeText, '', 'Text-input is not empty')
        .assertElementExists(nodeCheckbox + ':not(:checked)', 'Checkbox is still checked')

        .assertElementExists(nodeCheckboxDVS + ':not(:checked)', 'DVS Checkbox is still checked')

        // Cancel changes
        .clickByCssSelector('button.discard-changes')
        .waitForCssSelector('.discard-changes:disabled', 1000)

        // Verify that saved values loaded
        .assertElementExists(nodeCheckboxDVS + ':checked', 'DVS Checkbox is not checked')

        .assertInputValueEquals(nodeText, 'some_data', 'Text-input is empty')
        .assertElementExists(nodeCheckbox + ':checked', 'Checkbox is not checked')

        // Load defaults
        .clickByCssSelector(btnLoadDefaults)
        .waitForCssSelector(btnLoadDefaults + ':not(:disabled)', 1000)

        // Save with default values
        .assertElementEnabled(btnApply, 'Apply is disabled')
        .clickByCssSelector(btnApply)
        .waitForCssSelector(btnLoadDefaults + ':not(:disabled)', 1000)

        .then(() => modal.close())
        .then(() => modal.waitToClose());
    },
    node_restrictions() {  // Test restrictions for Nodes
      return this.remote
        .updatePlugin('update_nodes node_restrict')
        .newClusterWithPlugin(modal)

        // Add node and open settings for it
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .clickByCssSelector('.node-settings')
        .then(() => modal.waitToOpen())

        // Check that Checkbox is visible, but Text-input isn't
        .clickByCssSelector('#headingattributes')
        .assertElementExists(nodeCheckbox, 'Checkbox is not presented')
        .assertElementNotExists(nodeText, 'Text-input is presented')

        // Enable KVM in Settings -> Compute
        .then(() => modal.close())
        .then(() => modal.waitToClose())
        .clickByCssSelector('a.settings.cluster-tab')

        .clickByCssSelector('a.subtab-link-compute')
        .clickByCssSelector('input[name="libvirt_type"][value="kvm"]')

        .clickByCssSelector('button.btn-apply-changes')
        .waitForCssSelector(btnLoadDefaults + ':not(:disabled)', 1000)

        // Open Settings for the node, check that all attributes are presented
        .then(() => clusterPage.goToTab('Nodes'))
        .clickByCssSelector('.node-settings')
        .then(() => modal.waitToOpen())
        .clickByCssSelector('#headingattributes')
        .assertElementExists(nodeCheckbox, 'Checkbox is not presented')
        .assertElementExists(nodeText, 'Text-input is not presented')

        .then(() => modal.close())
        .then(() => modal.waitToClose());
    }
  };
});
