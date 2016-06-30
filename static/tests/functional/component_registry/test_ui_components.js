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
import 'tests/functional/component_registry/component_helpers';
import 'tests/functional/helpers';

registerSuite(() => {
  var common, modal;

  return {
    name: 'Hypervisors',
    setup() {
      common = new Common(this.remote);
      modal = new Modal(this.remote);
      return this.remote
       .then(() => common.getIn());
    },
    'Test that all components, chosen in Wizard tab, are enabled on Setting tab': function() {
      return this.remote
        .updatePlugin('dvs_default contrail_default')
        .newClusterFillName(modal)

        .pressKeys('\uE007')  // go to Compute

        // Create cluster with all compatible elements in wizard
        .clickByCssSelector('input[value=hypervisor\\:vmware]')  // vCenter
        .pressKeys('\uE007')  // Networking
        .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:dvs]')  // VMware DVS
        .pressKeys('\uE007')  // Storage
        .clickByCssSelector('input[value=storage\\:image\\:ceph]')  // image Ceph
        .clickByCssSelector('input[value=storage\\:object\\:ceph]')  // object Ceph
        .clickByCssSelector('input[value=storage\\:ephemeral\\:ceph]')  // ephemeral Ceph
        .pressKeys('\uE007')  // Additional Services
        .clickByCssSelector('input[value=additional_service\\:sahara]')  // Sahara
        .clickByCssSelector('input[value=additional_service\\:murano]')  // Murano
        .clickByCssSelector('input[value=additional_service\\:ceilometer]')  // Ceilometer
        .clickByCssSelector('input[value=additional_service\\:ironic]')  // Ironic
        .pressKeys('\uE007')  // Finish
        .pressKeys('\uE007')  // Create
        .then(() => modal.waitToClose())

        // Check that all components, chosen in Wizard tab, are enabled on Setting tab
        .clickByCssSelector('a.network.cluster-tab')
        .clickByCssSelector('li.network_settings')
        .assertElementEnabled('input[label="Neutron VMware DVS ML2 plugin"]',
                               'DVS plugin is disabled')  // VMware DVS
        .assertElementEnabled('input[name=vmware_dvs_net_maps]',
                               'Field for dvSwitch is not active')
        .clickByCssSelector('a.settings.cluster-tab')
        .clickByCssSelector('a.subtab-link-storage')
        .assertElementPropertyEquals('input[name=images_ceph]', 'checked', true,
                                     'image Ceph is disabled')  // image Ceph
        .assertElementPropertyEquals('input[name=objects_ceph]', 'checked', true,
                                     'object Ceph is disabled')  // object Ceph
        .assertElementPropertyEquals('input[name=ephemeral_ceph]', 'checked', true,
                                     'ephemeral Ceph is disabled')  // ephemeral Ceph
        .clickByCssSelector('a.subtab-link-openstack_services')
        .assertElementPropertyEquals('input[name=sahara]', 'checked', true,
                                     'Sahara is disabled')  // Sahara
        .assertElementPropertyEquals('input[name=murano]', 'checked', true,
                                     'Murano is disabled')  // Murano
        .assertElementPropertyEquals('input[name=ceilometer]', 'checked', true,
                                     'Ceilometer is disabled')  // Ceilometer
        .assertElementPropertyEquals('input[name=ironic]', 'checked', true,
                                     'Ironic is disabled')  // Ironic
        .assertElementExists('a.vmware.cluster-tab',
                             'VMware tab is not presented')  // vCenter

        // Delete created environment
        .clickByCssSelector('a.dashboard.cluster-tab')
        .clickByCssSelector('button.delete-environment-btn')
        .clickByCssSelector('button.remove-cluster-btn');
    },
    'Test that when vcenter is selected as compute, contrail should be turned off': function() {
      return this.remote
        .updatePlugin('dvs_default contrail_default')
        .newClusterFillName(modal)

        .pressKeys('\uE007')  // go to Compute

        // Check that contrail is disabled when vCenter is enabled
        .clickByCssSelector('input[value=hypervisor\\:vmware]')
        .pressKeys('\uE007')  // Networking
        .assertElementDisabled('input[value=network\\:neutron\\:contrail]',
                               'Contrail checkbox is enabled with vCenter')
        .then(() => modal.close());
    }
  };
});
