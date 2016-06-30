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
import 'tests/functional/helpers';
import 'tests/functional/component_registry/component_helpers';

registerSuite(() => {
  var common, modal;

  return {
    name: 'Storage',
    setup() {
      common = new Common(this.remote);
      modal = new Modal(this.remote);
      return this.remote
       .then(() => common.getIn());
    },
    afterEach() {
      return this.remote
        .then(() => modal.close())
        .catch(() => true)
        .then(() => modal.waitToClose());
    },
    'Test storage, -object'() {
      var nfs = 'input[value=storage\\:block\\:nfs]';
      var cat = 'input[value=storage\\:object\\:cat]';
      var sheepdog = 'input[value=storage\\:object\\:sheepdog]';

      return this.remote
        .updatePlugin('dvs_default test_storage_block_nfs')
        .newClusterFillName(modal)

        .pressKeys('\uE007')  // go to Compute
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Networking
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Storage

        // Check that cat and sheepdog are disabled when nfs is enabled
        .clickByCssSelector(nfs)
        .assertElementDisabled(cat, 'Cat checkbox is enabled with nfs')
        .assertElementDisabled(sheepdog, 'Sheepdog checkbox is enabled with nfs')

        // Check that nfs is disabled when cat and sheepdog are enabled
        .clickByCssSelector(nfs)
        .clickByCssSelector(cat)
        .assertElementDisabled(nfs, 'Nfs checkbox is enabled with cat')
        .clickByCssSelector(sheepdog)
        .assertElementDisabled(nfs, 'Nfs checkbox is enabled with sheepdog')
        .clickByCssSelector(cat)
        .clickByCssSelector(sheepdog)

        // Create cluster with nfs Block Storage
        .clickByCssSelector(nfs)
        .pressKeys('\uE007')  // Additional Services
        .pressKeys('\uE007')  // Finish
        .pressKeys('\uE007')  // Create
        .then(() => modal.waitToClose())

        // Delete created environment
        .deleteCluster(modal).sleep(10000);
    },
    'Test storage -storage:image'() {
      var nfs = 'input[value=storage\\:image\\:nfs]';
      var zfs = 'input[value=storage\\:block\\:zfs]';

      return this.remote
        .updatePlugin('dvs_default test_storage_block_zfs')
        .newClusterFillName(modal)

        .pressKeys('\uE007')  // go to Compute
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Networking
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Storage

        // Check that zfs block storage is disabled when nfs image storage enabled
        .clickByCssSelector(nfs)
        .assertElementDisabled(zfs, 'Zfs checkbox is enabled with nfs')

        // Check that nfs image storage is disabled when zfs block storage enabled
        .clickByCssSelector(nfs)  // disable nfs
        .clickByCssSelector(zfs)
        .assertElementDisabled(nfs, 'Nfs checkbox is enabled with zfs')

        // Create cluster with zfs
        .pressKeys('\uE007')  // Additional Services
        .pressKeys('\uE007')  // Finish
        .pressKeys('\uE007')  // Create
        .then(() => modal.waitToClose())

        // Delete created environment
        .deleteCluster(modal);
    },
    'Test storage:image, -image:ceph'() {
      var swift = 'input[value=storage\\:image\\:swift]';
      var ceph = 'input[value=storage\\:image\\:ceph]';

      return this.remote
        .updatePlugin('dvs_default test_storage_image_swift')
        .newClusterFillName(modal)

        .pressKeys('\uE007')  // go to Compute
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Networking
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Storage

        // Check that Ceph image storage is inactive when swift image storage is
        // active and vice versa
        .clickByCssSelector(swift)
        .assertElementPropertyEquals(ceph, 'checked', false, 'Ceph is enabled with swift')
        .clickByCssSelector(ceph)
        .assertElementPropertyEquals(swift, 'checked', false, 'Swift is enabled with ceph');
    },
    'Test storage:image, -image:ceph, +storage:image'() {
      var ceph = 'input[value=storage\\:image\\:ceph]';
      var swift = 'input[value=storage\\:image\\:swift]';

      return this.remote
        .updatePlugin('dvs_default test_storage_image_swift_cat')
        .newClusterFillName(modal)

        .pressKeys('\uE007')  // go to Compute
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Networking
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Storage

        // Check that Ceph image storage is inactive when swift image storage is
        // active and vice versa
        .clickByCssSelector('input[value=storage\\:image\\:cat]')
        .clickByCssSelector(ceph)
        .assertElementDisabled(swift, 'Swift is enabled with ceph')
        .clickByCssSelector(ceph)  // disable Ceph
        .clickByCssSelector(swift)
        .assertElementDisabled(ceph, 'Ceph is enabled with swift')

        // Create cluster with qemu + Neutron vlan + Swift + cat
        .pressKeys('\uE007')  // Additional Services
        .pressKeys('\uE007')  // Finish
        .pressKeys('\uE007')  // Create
        .then(() => modal.waitToClose())

        // Delete created environment
        .deleteCluster(modal);
    },
    'Test storage:object, -block:lvm'() {
      var cat = 'input[value=storage\\:object\\:cat]';

      return this.remote
        .updatePlugin('dvs_default test_storage_object_cat')
        .newClusterFillName(modal)

        .pressKeys('\uE007')  // go to Compute
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Networking
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Storage

        // Check that cat is disabled when LVM is enabled (by default)
        .assertElementDisabled(cat, 'cat is enabled with LVM')

        // Create cluster with Ceph block storage + Stor ceph
        .clickByCssSelector('input[value=storage\\:block\\:ceph]')
        .clickByCssSelector(cat)
        .pressKeys('\uE007')  // Additional Services
        .pressKeys('\uE007')  // Finish
        .pressKeys('\uE007')  // Create
        .then(() => modal.waitToClose())

        // Delete created environment
        .deleteCluster(modal);
    }
  };
});
