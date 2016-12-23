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

define([
  'intern!object',
  'tests/functional/helpers',
  'tests/functional/real_plugin/plugin_helpers',
  'tests/functional/pages/common',
  'tests/functional/pages/modal',
  'tests/functional/pages/cluster'
], function(registerSuite, helpers, pluginHelpers, Common, Modal, ClusterPage) {
  'use strict';

  registerSuite(function() {
    var common, modal, clusterPage;

    var attrLabelPlugin1 = 'span.fuel_plugin_example_v5';
    var attrLabelPlugin2 = 'span.fuel-plugin-vmware-dvs';

    var bondCheckbox = 'input[type="checkbox"][name="attribute_checkbox"]';
    var bondText = 'input[type="text"][name="attribute_text"]';

    var itfConfigure = 'button.btn-configure-interfaces';

    return {
      name: 'BONDs',
      timeout: 4 * 60 * 1000,
      setup: function() {
        common = new Common(this.remote);
        modal = new Modal(this.remote);
        clusterPage = new ClusterPage(this.remote);

        return this.remote
         .then(function() {
           return common.getIn();
         });
      },
      afterEach: function() {
        return this.remote
          .deleteCluster(modal);
      },
      test_bonds: function() {  // Test attributes for BOND interfaces provided by plugin
        return this.remote
          .updatePlugin('update_bonds bond_setup')
          .newClusterWithPlugin(modal)

          // Add one node, open interface configuration
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .selectNodeByIndex(0)
          .clickByCssSelector(itfConfigure)

          // Bond several interfaces and verify that provided attributes are presented for them
          .bondInterfaces(-1, -2)
          .assertElementExists('.ifc-list > div:nth-child(1) ' + attrLabelPlugin1,
                               'Bonds attributes are not presented')

          // Save changes
          .applyItfChanges();
      },
      bond_defaults: function() {  // Test Load defaults for BONDs
        return this.remote
          .newClusterWithPlugin(modal)

          // Add one node, open interface configuration
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .selectNodeByIndex(0)
          .clickByCssSelector(itfConfigure)

          // Bond several interfaces and verify that provided attributes are presented for them
          .bondInterfaces(-1, -2)
          .assertElementExists('input[label="bond0"]', 'Bonds was not created')
          .assertElementExists('.ifc-list > div:nth-child(1) ' + attrLabelPlugin1,
                               'Bonds attributes are not presented')

          // Save changes
          .applyItfChanges()

          // Load Defaults and save changes
          .clickByCssSelector('button.btn-defaults')
          .waitForCssSelector('.btn-defaults:not(:disabled)', 1000)
          .assertElementNotExists('input[label="bond0"]', 'Interfaces were not unbonded')
          .applyItfChanges();
      },
      bond_multiple_plugins: function() {  // Test several plugins with different BOND configs
        var bondCheckboxDVS = 'input[type="checkbox"][name="attribute_checkbox_b"]';

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
          .then(function() {
            return modal.waitToClose();
          })

          // Add one node, open interface configuration
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .selectNodeByIndex(0)
          .clickByCssSelector(itfConfigure)

          // Bond several interfaces, verify attributes provided by both of plugins
          .bondInterfaces(-1, -2)
          .assertElementExists('input[label="bond0"]', 'Bonds was not created')
          .assertElementExists('.ifc-list > div:nth-child(1) ' + attrLabelPlugin1,
                               'Bond attributes for plugin-1 are not presented')
          .assertElementExists('.ifc-list > div:nth-child(1) ' + attrLabelPlugin2,
                               'Bond attributes for plugin-2 are not presented')

          .expandNICPropertyByIndex(attrLabelPlugin1, 0)

          .setInputValue(bondText, 'some_data')

          .assertElementEnabled(bondCheckbox, 'Checkbox is disabled')
          .clickByCssSelector(bondCheckbox)

          .assertInputValueEquals(bondText, 'some_data', 'Text-input is empty')

          .expandNICPropertyByIndex(attrLabelPlugin2, 0)

          .assertElementEnabled(bondCheckboxDVS, 'DVS Checkbox is disabled')
          .clickByCssSelector(bondCheckboxDVS)

          .assertElementExists(bondCheckboxDVS + ':checked', 'DVS Checkbox was not checked')

          .expandNICPropertyByIndex(attrLabelPlugin1, 0)

          .assertElementExists(bondCheckbox + ':checked', 'Checkbox was not checked')

          .applyItfChanges()

          // Load defaults
          .clickByCssSelector('button.btn-defaults')
          .waitForCssSelector('.btn-defaults:not(:disabled)', 1000)

          // Verify that defaults were loaded
          .assertElementNotExists('input[label="bond0"]', 'Defaults were not loaded')
          .assertElementNotExists(bondText, 'Defaults were not loaded')
          .assertElementNotExists(bondCheckbox, 'Defaults were not loaded')
          .assertElementNotExists(bondCheckboxDVS, 'Defaults were not loaded')

          // Cancel changes
          .clickByCssSelector('button.btn-revert-changes')
          .waitForCssSelector('.btn-revert-changes:disabled', 1000)

          // Verify that saved values loaded
          .assertElementExists('input[label="bond0"]', 'Saved values were not loaded')

          .expandNICPropertyByIndex(attrLabelPlugin1, 0)
          .assertInputValueEquals(bondText, 'some_data', 'Text-input is empty')
          .assertElementExists(bondCheckbox + ':checked', 'Checkbox is not checked')

          .expandNICPropertyByIndex(attrLabelPlugin2, 0)
          .assertElementExists(bondCheckboxDVS + ':checked', 'DVS Checkbox is not checked')

          // Load defaults
          .clickByCssSelector('button.btn-defaults')
          .waitForCssSelector('.btn-defaults:not(:disabled)', 1000)

          // Save with default values
          .applyItfChanges();
      },
      bond_restrictions: function() {  // Test restrictions for Bonds
        return this.remote
          .updatePlugin('update_bonds bond_restrict')
          .newClusterWithPlugin(modal)

          // Add one node, open interface configuration
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .selectNodeByIndex(0)
          .clickByCssSelector(itfConfigure)

          // Bond several interfaces and save changes
          .bondInterfaces(-1, -2)
          .assertElementExists('input[label="bond0"]', 'Bonds was not created')
          .applyItfChanges()

          // Check that Checkbox is visible, but Text-input isn't
          .expandNICPropertyByIndex(attrLabelPlugin1, 0)
          .clickByCssSelector(bondCheckbox)
          .assertElementNotExists(bondText, 'Text-input field is displayed')

          // Enable KVM
          .clickByCssSelector('a.settings.cluster-tab')
          .clickByCssSelector('button.btn-danger.proceed-btn')  // Discard changes
          .then(function() {
            return modal.waitToClose();
          })

          .clickByCssSelector('a.subtab-link-compute')
          .clickByCssSelector('input[name="libvirt_type"][value="kvm"]')

          .clickByCssSelector('button.btn-apply-changes')
          .waitForCssSelector('.btn-load-defaults:not(:disabled)', 1000)

          // Verify that text input is displayed
          .then(function() {
            return clusterPage.goToTab('Nodes');
          })
          .clickByCssSelector(itfConfigure)
          .expandNICPropertyByIndex(attrLabelPlugin1, 0)
          .assertElementExists(bondCheckbox, 'Checkbox is not displayed')
          .assertElementExists(bondText, 'Text-input field is not displayed');
      }
    };
  });
});
