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

define([
  'intern!object',
  'intern/chai!assert',
  'tests/functional/helpers',
  'tests/functional/pages/common',
  'tests/functional/pages/modal'
], function(registerSuite, assert, helpers, Common, Modal) {
  registerSuite(function() {
    var common, modal;

    return {
      name: 'C842449',
      setup: function() {
        common = new Common(this.remote);
        modal = new Modal(this.remote);
        return this.remote
          .then(function() {
            return common.getIn();
          });
      },
      beforeEach: function() {
        var clusterName = common.pickRandomName('Temp');
        return this.remote
          .clickByCssSelector('.create-cluster')
          .then(function() {
            return modal.waitToOpen();
          })
          .setInputValue('[name=name]', clusterName);
      },
      'Test hypervisor, -hyperv*, !Murano, +Ceilometer': function() {
        var sun = 'input[value=hypervisor\\:test\\:sun]';
        var rain = 'input[value=hypervisor\\:test\\:rain]';
        var xen = 'input[value=hypervisor\\:xen]';

        return this.remote
          .pressKeys('\uE007')  // go to Compute

          // Check that xen is not compatible with sun and rain hypervisors
          .clickByCssSelector(sun)
          .assertElementDisabled(xen, 'Xen checkbox is enabled with sun')
          .clickByCssSelector(rain)
          .assertElementDisabled(xen, 'Xen checkbox is enabled with sun + rain')
          .clickByCssSelector(sun)
          .assertElementDisabled(xen, 'Xen checkbox is enabled with rain')
          .clickByCssSelector(rain)

          .clickByCssSelector(xen)
          .assertElementDisabled(sun, 'Sun checkbox is enabled with xen')
          .assertElementDisabled(rain, 'Rain checkbox is enabled with xen')

          // Try to create cluster with xen without Murano
          .pressKeys('\uE007')  // Networking
          .pressKeys('\uE007')  // Storage
          .pressKeys('\uE007')  // Additional Services
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(function() {
            return modal.waitToOpen().sleep(100);
          })
          .assertElementTextEquals('div.text-error', 'Requires [u\'additional_service:murano\'] ' +
                                   'for \'hypervisor:xen\' components were not satisfied.',
                                   'Error was not displayed')
          .then(function() {
            return modal.close();
          });
      },
      'Test create cluster with xen + Murano + Ceilometer': function() {
        return this.remote
          // Create cluster with xen + Murano + Ceilometer
          .pressKeys('\uE007')  // go to Compute
          .clickByCssSelector('input[value=hypervisor\\:xen]')
          .pressKeys('\uE007')  // Networking
          .pressKeys('\uE007')  // Storage
          .pressKeys('\uE007')  // Additional Services
          .clickByCssSelector('input[value=additional_service\\:murano]')
          .clickByCssSelector('input[value=additional_service\\:ceilometer]')
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(function() {
            return modal.waitToOpen().sleep(100);
          })

          // Delete created environment
          .clickByCssSelector('button.delete-environment-btn')
          .clickByCssSelector('button.remove-cluster-btn');
      }
    };
  });
});
