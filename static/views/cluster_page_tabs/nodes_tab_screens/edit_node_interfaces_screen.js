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
import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import React from 'react';
import i18n from 'i18n';
import utils from 'utils';
import models from 'models';
import dispatcher from 'dispatcher';
import Expression from 'expression';
import OffloadingModes from 'views/cluster_page_tabs/nodes_tab_screens/offloading_modes_control';
import {Input, Tooltip, ProgressButton, Link} from 'views/controls';
import {backboneMixin, unsavedChangesMixin} from 'component_mixins';
import {DragSource, DropTarget} from 'react-dnd';
import ReactDOM from 'react-dom';
import SettingSection from 'views/cluster_page_tabs/setting_section';

var ns = 'cluster_page.nodes_tab.configure_interfaces.';

var EditNodeInterfacesScreen = React.createClass({
  mixins: [
    backboneMixin('interfaces', 'change reset update'),
    backboneMixin('cluster'),
    backboneMixin('nodes', 'change reset update'),
    unsavedChangesMixin
  ],
  statics: {
    fetchData(options) {
      var cluster = options.cluster;
      var nodes = utils.getNodeListFromTabOptions(options);

      if (!nodes || !nodes.areInterfacesConfigurable()) {
        return Promise.reject();
      }

      var networkConfiguration = cluster.get('networkConfiguration');
      var networksMetadata = new models.ReleaseNetworkProperties();
      var bondDefaultAttributes = new models.BondDefaultAttributes();
      bondDefaultAttributes.nodeId = nodes.at(0).id;

      return Promise.all(nodes.map((node) => {
        node.interfaces = new models.Interfaces();
        return node.interfaces.fetch({
          url: _.result(node, 'url') + '/interfaces',
          reset: true
        });
      }).concat([
        networkConfiguration.fetch({cache: true}),
        networksMetadata.fetch({
          url: '/api/releases/' + cluster.get('release_id') + '/networks'
        }),
        bondDefaultAttributes.fetch({cache: true})
      ]))
        .then(() => {
          var interfaces = new models.Interfaces();
          interfaces.set(_.cloneDeep(nodes.at(0).interfaces.toJSON()), {parse: true});
          return {
            interfaces,
            nodes,
            bondingConfig: networksMetadata.get('bonding'),
            bondDefaultAttributes,
            configModels: {
              version: app.version,
              cluster: cluster,
              settings: cluster.get('settings')
            }
          };
        });
    }
  },
  getInitialState() {
    var interfacesByIndex = {};
    var indexByInterface = {};
    var firstNodeInterfaces = this.props.interfaces.filter((ifc) => !ifc.isBond());
    this.props.nodes.each((node, nodeIndex) => {
      var justInterfaces = node.interfaces.filter((ifc) => !ifc.isBond());
      _.each(justInterfaces, (ifc, index) => {
        indexByInterface[ifc.id] = index;
        interfacesByIndex[index] = _.union(
          interfacesByIndex[index],
          [nodeIndex ? ifc : firstNodeInterfaces[index]]
        );
      });
    });
    var viewMode = _.first(this.props.viewModes);

    return {
      actionInProgress: false,
      interfacesErrors: {},
      interfacesByIndex,
      indexByInterface,
      settingSectionKey: _.now(),
      viewMode
    };
  },
  getDefaultProps() {
    return {
      viewModes: ['standard', 'compact']
    };
  },
  componentWillMount() {
    this.setState({
      initialInterfaces: _.cloneDeep(this.interfacesToJSON(this.props.interfaces)),
      limitations: this.getEditLimitations()
    });
  },
  componentDidMount() {
    this.validate();
  },
  compareInterfaceAttributes(interfaces, section, sectionName) {
    // handle offloading attribute
    if (sectionName === 'offloading') {
      var omitState = (modes) => _.map(modes, (mode) => _.omit(mode, 'state'));
      var firstIfcOffloadingModes = omitState(interfaces[0].get('meta').offloading_modes);
      return _.every(interfaces,
        (ifc) => _.isEqual(firstIfcOffloadingModes, omitState(ifc.get('meta').offloading_modes))
      );
    }

    // compare interface attributes have identical structure for all interfaces
    return _.every(interfaces, (ifc) => {
      var attributeMeta = ifc.get('meta')[sectionName] || {};
      return (_.isUndefined(attributeMeta.available) || attributeMeta.available) &&
        ifc.get('attributes').get(sectionName) &&
        _.every(section, (setting, settingName) =>
          _.isEqual(
            _.omit(ifc.get('attributes').get(utils.makePath(sectionName, settingName)), 'value'),
            _.omit(setting, 'value')
          )
        );
    });
  },
  getInterfacesLimitations(interfaces) {
    // section is editable for the interfaces when
    // 1) for each ifc meta[section].available==true or meta[section].available==undefined
    // 2) settings in the section differ only in value fields
    var limitations = {};
    _.each(interfaces[0].get('attributes').attributes, (section, sectionName) => {
      limitations[sectionName] = {
        equal: this.compareInterfaceAttributes(interfaces, section, sectionName),
        shown: section
      };
    });
    return limitations;
  },
  getEditLimitations() {
    // Gets limitations for interfaces parameters editing.
    // Parameter should not be editable if it is differently available
    // across the nodes interfaces.
    // There are 3 types of interfaces to be treaten differently:
    // 1) interface (supposed to be similar on all nodes by index, unremovable)
    // 2) saved bonds (might be configured differently across the nodes,
    //    removable, affect interfaces order)
    // 3) unsaved bonds (exist on the first node only)

    var {interfacesByIndex, indexByInterface} = this.state;

    // Calculate limitations for case 1
    var result = _.reduce(
      interfacesByIndex,
      (result, interfaces) => {
        result[interfaces[0].id] = this.getInterfacesLimitations(interfaces);
        return result;
      }, {}
    );

    // Limitations for cases 2 and 3
    _.each(
      this.props.interfaces.filter((ifc) => ifc.isBond()),
      (ifc) => {
        var interfaces = _.flatten(
          _.map(ifc.getSlaveInterfaces(),
            (slave) => interfacesByIndex[indexByInterface[slave.id]]
          )
        );
        result[ifc.get('name')] = this.getInterfacesLimitations(interfaces);
      }
    );
    return result;
  },
  isLocked() {
    return !!this.props.cluster.task({group: 'deployment', active: true}) ||
      !_.every(this.props.nodes.invokeMap('areInterfacesConfigurable'));
  },
  interfacesPickFromJSON(json) {
    // Pick certain interface fields that have influence on hasChanges.
    return _.pick(json, ['assigned_networks', 'mode', 'type', 'slaves', 'attributes']);
  },
  interfacesToJSON(interfaces, remainingNodesMode) {
    // Sometimes 'state' is sent from the API and sometimes not
    // It's better to just unify all inputs to the one without state.
    var picker = remainingNodesMode ? this.interfacesPickFromJSON : (json) => _.omit(json, 'state');
    return interfaces.map((ifc) => picker(ifc.toJSON()));
  },
  hasChangesInRemainingNodes() {
    var {nodes} = this.props;
    var {initialInterfaces, limitations} = this.state;

    var initialInterfacesData = _.map(initialInterfaces, this.interfacesPickFromJSON);
    var limitationsKeys = nodes.at(0).interfaces.map(
      (ifc) => ifc.get(ifc.isBond ? 'name' : 'id')
    );

    return _.some(nodes.slice(1), (node) => {
      var interfacesData = this.interfacesToJSON(node.interfaces, true);
      return _.some(initialInterfacesData, (ifcData, index) => {
        var limitationsData = limitations[limitationsKeys[index]];
        var omittedProperties = _.filter(_.keys(limitationsData),
          (key) => !_.get(limitationsData[key], 'equal', true)
        );
        return _.some(ifcData, (data, attribute) => {
          // Restricted parameters should not participate in changes detection
          switch (attribute) {
            case 'attributes': {
              // FIXME(jkirnosova): need to support exception for offloading control
              //// do not compare offloading modes if they differ
              //if (!_.get(limitationsData, 'offloading.equal', false)) return false;
              //// otherwise remove set states before it
              //return !_.isEqual(..._.invokeMap(
              //    [data, interfacesData[index][attribute]],
              //    (value) => utils.deepOmit(value, ['state']))
              //);

              // omit restricted parameters from the comparison
              return !_.isEqual(..._.invokeMap(
                [data, interfacesData[index][attribute]],
                _.omit, omittedProperties)
              );
            }
            case 'slaves': {
              // bond 'slaves' attribute contains information about slave name only
              // but interface names can be different between nodes
              // and can not be used for the comparison
              return data.length !== (interfacesData[index].slaves || {}).length;
            }
          }
          return !_.isEqual(data, interfacesData[index][attribute]);
        });
      });
    });
  },
  hasChanges() {
    return !this.isLocked() &&
      (!_.isEqual(this.state.initialInterfaces, this.interfacesToJSON(this.props.interfaces)) ||
      this.props.nodes.length > 1 && this.hasChangesInRemainingNodes());
  },
  loadDefaults() {
    this.setState({actionInProgress: 'load_defaults'});
    this.props.interfaces.fetch({
      url: _.result(this.props.nodes.at(0), 'url') + '/interfaces/default_assignment', reset: true
    })
    .catch(
      (response) => {
        var errorNS = ns + 'configuration_error.';
        utils.showErrorDialog({
          title: i18n(errorNS + 'title'),
          message: i18n(errorNS + 'load_defaults_warning'),
          response
        });
      }
    )
    .then(() => {
      this.setState({actionInProgress: false, settingSectionKey: _.now()});
    });
  },
  revertChanges() {
    this.props.interfaces.reset(_.cloneDeep(this.state.initialInterfaces), {parse: true});
    this.setState({settingSectionKey: _.now()});
  },
  updateWithLimitations(sourceInterface, targetInterface) {
    // Interface parameters should be updated with respect to limitations:
    // restricted parameters should not be changed
    var limitations = this.state.limitations[sourceInterface.id];
    var targetAttributes = targetInterface.get('attributes');
    var sourceAttributes = sourceInterface.get('attributes');

    _.each(sourceAttributes.attributes, (section, sectionName) => {
      var sectionLimitations = limitations[sectionName];
      var isEqual = _.get(sectionLimitations, utils.makePath(sectionName, 'equal'));
      if (!sectionLimitations || isEqual) {
        targetAttributes.set(sectionName, _.cloneDeep(sourceAttributes.get(sectionName)));
      }
    });
  },
  applyChanges() {
    if (!this.isSavingPossible()) return Promise.reject();
    this.setState({actionInProgress: 'apply_changes'});

    var nodes = this.props.nodes;
    var interfaces = this.props.interfaces;
    var bond = interfaces.filter((ifc) => ifc.isBond());
    var bondsByName = bond.reduce((result, bond) => {
      result[bond.get('name')] = bond;
      return result;
    }, {});

    // bonding map contains indexes of slave interfaces
    // it is needed to build the same configuration for all the nodes
    // as interface names might be different, so we use indexes
    var bondingMap = _.map(bond,
      (bond) => _.map(bond.get('slaves'), (slave) => interfaces.indexOf(interfaces.find(slave)))
    );

    return Promise.all(nodes.map((node) => {
      var oldNodeBonds, nodeBonds;
      // removing previously configured bond
      oldNodeBonds = node.interfaces.filter((ifc) => ifc.isBond());
      node.interfaces.remove(oldNodeBonds);
      // creating node-specific bond without slaves
      nodeBonds = _.map(bond, (bond) => {
        return new models.Interface(_.omit(bond.toJSON(), 'slaves'), {parse: true});
      });
      node.interfaces.add(nodeBonds);
      // determining slaves using bonding map
      _.each(nodeBonds, (bond, bondIndex) => {
        var slaveIndexes = bondingMap[bondIndex];
        var slaveInterfaces = _.map(slaveIndexes, (index) => node.interfaces.at(index));
        bond.set({slaves: _.invokeMap(slaveInterfaces, 'pick', 'name')});
      });

      // Assigning networks according to user choice and interface properties
      node.interfaces.each((ifc, index) => {
        var updatedIfc = ifc.isBond() ? bondsByName[ifc.get('name')] : interfaces.at(index);
        ifc.set({
          assigned_networks: new models.InterfaceNetworks(
            updatedIfc.get('assigned_networks').toJSON()
          )
        });
        this.updateWithLimitations(updatedIfc, ifc);
      });

      return Backbone.sync('update', node.interfaces, {url: _.result(node, 'url') + '/interfaces'});
    }))
      .then(
        () => {
          this.setState({
            initialInterfaces: _.cloneDeep(this.interfacesToJSON(this.props.interfaces)),
            actionInProgress: false
          });
          dispatcher.trigger('networkConfigurationUpdated');
        },
        (response) => {
          var errorNS = ns + 'configuration_error.';
          this.setState({actionInProgress: false});
          utils.showErrorDialog({
            title: i18n(errorNS + 'title'),
            message: i18n(errorNS + 'saving_warning'),
            response: response
          });
        }
      );
  },
  configurationTemplateExists() {
    return !_.isEmpty(this.props.cluster.get('networkConfiguration')
      .get('networking_parameters').get('configuration_template'));
  },
  getAvailableBondingTypes(ifc) {
    if (ifc.isBond()) return [ifc.get('attributes').get('type__.value')];

    return _.compact(
      _.flatten(
        _.map(
          this.props.bondingConfig.availability,
          (modesAvailability) => _.map(
            modesAvailability,
            (condition, mode) => (new Expression(
              condition, this.props.configModels, {strict: false}
            )).evaluate({interface: ifc, attributes: ifc.get('attributes')}) && mode
          )
    )));
  },
  findOffloadingModesIntersection(set1, set2) {
    return _.map(
      _.intersection(
        _.map(set1, 'name'),
        _.map(set2, 'name')
      ),
      (name) => {
        return {
          name,
          state: null,
          sub: this.findOffloadingModesIntersection(
            _.find(set1, {name}).sub,
            _.find(set2, {name}).sub
          )
        };
      });
  },
  getIntersectedOffloadingModes(interfaces) {
    return interfaces.reduce((result, ifc) =>
      this.findOffloadingModesIntersection(result, ifc.get('meta').offloading_modes || []), []
    );
  },
  getOffloadingModeStates(offloadingModes) {
    var offloadingModeStates = {};
    _.each(offloadingModes, ({name, state}) => {
      offloadingModeStates[name] = state;
    });
    return offloadingModeStates;
  },
  bondInterfaces(bondType) {
    this.setState({actionInProgress: true});
    var interfaces = this.props.interfaces.filter((ifc) => ifc.get('checked') && !ifc.isBond());
    var bond = this.props.interfaces.find((ifc) => ifc.get('checked') && ifc.isBond());
    var limitations = this.state.limitations;
    var bondName, offloadingModes;

    var bondAttributes = {};
    if (!bond) {
      // if no bond selected - create new one
      var bondMode = _.flatten(
        _.map(this.props.bondingConfig.properties[bondType].mode, 'values')
      )[0];
      bondName = this.props.interfaces.generateBondName('bond');

      offloadingModes = this.getIntersectedOffloadingModes(interfaces);

      bondAttributes = new models.InterfaceAttributes(this.props.bondDefaultAttributes.toJSON());
      bondAttributes.set({
        'type__.value': bondType,
        'mode.value.value': bondMode,
        'offloading.modes.value': this.getOffloadingModeStates(offloadingModes),
        'dpdk.enabled.value': _.every(interfaces,
          (ifc) => ifc.get('attributes').get('dpdk.enabled.value')
        )
      });
      var bondProperties = {
        type: 'bond',
        name: bondName,
        mode: bondMode,
        assigned_networks: new models.InterfaceNetworks(),
        slaves: _.invokeMap(interfaces, 'pick', 'name'),
        meta: {
          dpdk: {
            available: _.every(interfaces, (ifc) => (ifc.get('meta').dpdk || {}).available)
          },
          offloading_modes: offloadingModes
        },
        state: 'down'
      };
      bond = new models.Interface(bondProperties);
      bond.set('attributes', bondAttributes);
      limitations[bondName] = {};
    } else {
      // adding interfaces to existing bond
      bondAttributes = bond.get('attributes');
      bondName = bond.get('name');

      if (bondAttributes.get('dpdk.enabled.value')) {
        bondAttributes.set('dpdk.enabled.value', _.every(interfaces,
          (ifc) => ifc.get('attributes').get('dpdk.enabled.value')
        ));
      }

      offloadingModes = this.getIntersectedOffloadingModes(interfaces.concat(bond));
      bondAttributes.set({
        'offloading.modes.value': this.getOffloadingModeStates(offloadingModes)
      });
      bond.get('meta').offloading_modes = offloadingModes;

      bond.set({
        slaves: bond.get('slaves').concat(_.invokeMap(interfaces, 'pick', 'name'))
      });
      // remove the bond to add it later and trigger re-rendering
      this.props.interfaces.remove(bond, {silent: true});
    }
    limitations[bondName] = _.reduce(interfaces, (result, ifc) => {
      bond.get('assigned_networks').add(ifc.get('assigned_networks').models);
      ifc.get('assigned_networks').reset();
      ifc.set({checked: false});
      return this.mergeLimitations(result, limitations[ifc.id]);
    }, limitations[bondName]);

    _.each(limitations[bondName], (sectionLimitations, sectionName) => {
      var {equal, shown} = sectionLimitations;
      if (equal && bondAttributes.get(sectionName)) bondAttributes.set(sectionName, shown);
    });

    this.props.interfaces.add(bond);
    this.setState({
      actionInProgress: false,
      limitations
    });
  },
  mergeLimitations(result, sectionLimitation) {
    if (_.isEmpty(result)) {
      return _.cloneDeep(sectionLimitation);
    }
    return _.reduce(sectionLimitation, (result, section, sectionName) => {
      _.each(section, (setting, settingName) => {
        var resultLimitation = result[sectionName] && result[sectionName][settingName];
        if (resultLimitation && !_.isEqual(resultLimitation.shown, setting.shown)) {
          resultLimitation.equal = false;
        }
      });
      return result;
    }, result);
  },
  unbondInterfaces() {
    this.setState({actionInProgress: true});
    _.each(this.props.interfaces.filter({checked: true}), (bond) => {
      this.removeInterfaceFromBond(bond.get('name'));
    });
    this.setState({actionInProgress: false});
  },
  removeInterfaceFromBond(bondName, slaveInterfaceName) {
    var networks = this.props.cluster.get('networkConfiguration').get('networks');
    var bond = this.props.interfaces.find({name: bondName});
    var slaves = bond.get('slaves');
    var bondHasUnmovableNetwork = bond.get('assigned_networks').some((interfaceNetwork) => {
      return interfaceNetwork.getFullNetwork(networks).get('meta').unmovable;
    });
    var slaveInterfaceNames = _.map(slaves, 'name');
    var targetInterface = bond;

    // if PXE interface is being removed - place networks there
    if (bondHasUnmovableNetwork) {
      var pxeInterface = this.props.interfaces.find((ifc) => {
        return ifc.get('pxe') && _.includes(slaveInterfaceNames, ifc.get('name'));
      });
      if (!slaveInterfaceName || pxeInterface && pxeInterface.get('name') === slaveInterfaceName) {
        targetInterface = pxeInterface;
      }
    }

    // if slaveInterfaceName is set - remove it from slaves, otherwise remove all
    if (slaveInterfaceName) {
      var slavesUpdated = _.reject(slaves, {name: slaveInterfaceName});
      var names = _.map(slavesUpdated, 'name');
      var bondSlaveInterfaces = this.props.interfaces.filter(
        (ifc) => _.includes(names, ifc.get('name'))
      );

      var offloadingModes = this.getIntersectedOffloadingModes(bondSlaveInterfaces);
      bond.get('attributes').set({
        'offloading.modes.value': this.getOffloadingModeStates(offloadingModes)
      });
      bond.get('meta').offloading_modes = offloadingModes;

      bond.set({slaves: slavesUpdated});
    } else {
      bond.set({slaves: []});
    }

    // destroy bond if all slave interfaces have been removed
    if (!slaveInterfaceName && targetInterface === bond) {
      targetInterface = this.props.interfaces.find({name: slaveInterfaceNames[0]});
    }

    // move networks if needed
    if (targetInterface !== bond) {
      var interfaceNetworks = bond.get('assigned_networks').remove(
        bond.get('assigned_networks').models
      );
      targetInterface.get('assigned_networks').add(interfaceNetworks);
    }

    // if no slaves left - remove the bond
    if (!bond.get('slaves').length) {
      this.props.interfaces.remove(bond);
    }
  },
  validate() {
    var {interfaces, cluster} = this.props;
    var networkConfiguration = cluster.get('networkConfiguration');
    var networkingParameters = networkConfiguration.get('networking_parameters');
    var networks = networkConfiguration.get('networks');
    var slaveInterfaceNames = _.map(_.flatten(_.filter(interfaces.map('slaves'))), 'name');

    var interfacesErrors = {};
    interfaces.each((ifc) => {
      if (!_.includes(slaveInterfaceNames, ifc.get('name'))) {
        var interfaceErrors = {
          network_errors: ifc.validate({networkingParameters, networks})
        };
        ifc.get('attributes').isValid({cluster, meta: ifc.get('meta')});
        interfaceErrors.attributes = ifc.get('attributes').validationError;
        if (!_.isNull(interfaceErrors.network_errors) || !_.isNull(interfaceErrors.attributes)) {
          interfacesErrors[ifc.get('name')] = interfaceErrors;
        }
      }
    });
    this.setState({interfacesErrors});
  },
  validateSpeedsForBonding(interfaces) {
    var slaveInterfaces = _.flatten(_.invokeMap(interfaces, 'getSlaveInterfaces'), true);
    var speeds = _.invokeMap(slaveInterfaces, 'get', 'current_speed');
    // warn if not all speeds are the same or there are interfaces with unknown speed
    return _.uniq(speeds).length > 1 || !_.compact(speeds).length;
  },
  isSavingPossible() {
    return !_.chain(this.state.interfacesErrors).values().some().value() &&
      !this.state.actionInProgress && this.hasChanges();
  },
  getInterfaceProperty(property) {
    var {interfaces, nodes} = this.props;
    var bondsCount = interfaces.filter((ifc) => ifc.isBond()).length;
    var getPropertyValues = (ifcIndex) => {
      return _.uniq(nodes.map((node) => {
        var nodeBondsCount = node.interfaces.filter((ifc) => ifc.isBond()).length;
        var nodeInterface = node.interfaces.at(ifcIndex + nodeBondsCount);
        if (property === 'current_speed') return utils.showBandwidth(nodeInterface.get(property));
        return nodeInterface.get(property);
      }));
    };
    return interfaces.map((ifc, index) => {
      if (ifc.isBond()) {
        return _.map(ifc.get('slaves'),
          (slave) => getPropertyValues(interfaces.indexOf(interfaces.find(slave)) - bondsCount)
        );
      }
      return [getPropertyValues(index - bondsCount)];
    });
  },
  getAvailableBondingTypesForInterfaces(interfaces) {
    return _.intersection(... _.map(interfaces, this.getAvailableBondingTypes));
  },
  changeViewMode() {
    var viewMode = _.first(_.without(this.props.viewModes, this.state.viewMode));
    this.setState({viewMode});
  },
  render() {
    var nodesByNetworksMap = {};
    this.props.nodes.each((node) => {
      var networkNames = _.flatten(
        node.interfaces.map((ifc) => ifc.get('assigned_networks').map('name'))
      ).sort();
      nodesByNetworksMap[networkNames] = _.union(
        (nodesByNetworksMap[networkNames] || []),
        [node.id]
      );
    });
    if (_.size(nodesByNetworksMap) > 1) {
      return (
        <ErrorScreen
          {... _.pick(this.props, 'nodes', 'cluster')}
          nodesByNetworksMap={nodesByNetworksMap}
        />
      );
    }

    var {nodes, cluster, interfaces, viewModes, bondingConfig, configModels} = this.props;
    var {
      interfacesByIndex, indexByInterface, viewMode, actionInProgress,
      interfacesErrors, initialInterfaces
    } = this.state;
    var nodeNames = nodes.map('name');
    var locked = this.isLocked();
    var configurationTemplateExists = this.configurationTemplateExists();

    var checkedInterfaces = interfaces.filter((ifc) => ifc.get('checked') && !ifc.isBond());
    var checkedBonds = interfaces.filter((ifc) => ifc.get('checked') && ifc.isBond());

    var creatingNewBond = checkedInterfaces.length >= 2 && !checkedBonds.length;
    var addingInterfacesToExistingBond = !!checkedInterfaces.length && checkedBonds.length === 1;

    // Available bonding types for interfaces slice across the nodes
    var availableBondingTypes = {};
    var nodesInterfaces = interfaces.map((ifc) => {
      var interfacesSlice = ifc.isBond() ?
        _.map(
          ifc.getSlaveInterfaces(),
          (slave) => interfacesByIndex[indexByInterface[slave.id]]
        )
      :
        interfacesByIndex[indexByInterface[ifc.id]];

      var bondingTypesSlice = ifc.isBond() ?
        _.flatten(_.union([ifc], interfacesSlice.map(_.tail)))
      :
        interfacesSlice;
      availableBondingTypes[ifc.get('name')] =
          this.getAvailableBondingTypesForInterfaces(bondingTypesSlice);

      return _.flatten(interfacesSlice);
    });

    var bondType = _.intersection(... _.compact(_.map(availableBondingTypes,
      (types, ifcName) => {
        var ifc = interfaces.find({name: ifcName});
        return ifc && ifc.get('checked') ? types : null;
      }
    )))[0];
    var bondingPossible = (creatingNewBond || addingInterfacesToExistingBond) && !!bondType;

    var unbondingPossible = !checkedInterfaces.length && !!checkedBonds.length;

    var hasChanges = this.hasChanges();
    var slaveInterfaceNames = _.map(_.flatten(_.filter(interfaces.map('slaves'))), 'name');
    var loadDefaultsEnabled = !actionInProgress;
    var revertChangesEnabled = !actionInProgress && hasChanges;

    var invalidSpeedsForBonding = bondingPossible &&
      this.validateSpeedsForBonding(checkedBonds.concat(checkedInterfaces)) ||
      interfaces.some((ifc) => ifc.isBond() && this.validateSpeedsForBonding([ifc]));

    var interfaceSpeeds = this.getInterfaceProperty('current_speed');
    var interfaceNames = this.getInterfaceProperty('name');

    return (
      <div className='ifc-management-panel row'>
        <div className='title'>
          {i18n(ns + (locked ? 'read_only_' : '') + 'title',
            {count: nodes.length, name: nodeNames.join(', ')})}
        </div>
        {configurationTemplateExists &&
          <div className='col-xs-12'>
            <div className='alert alert-warning'>
              {i18n(ns + 'configuration_template_warning')}
            </div>
          </div>
        }
        <div className='view-mode-switcher col-xs-4'>
          <div className='btn-group' data-toggle='buttons'>
            {_.map(viewModes, (mode) => {
              return (
                <Tooltip key={mode + '-view'} text={i18n(ns + mode + '_mode_tooltip')}>
                  <label
                    className={utils.classNames({
                      'btn btn-default pull-left': true,
                      active: mode === viewMode,
                      [mode]: true
                    })}
                    onClick={mode !== viewMode && this.changeViewMode}
                  >
                    <input type='radio' name='view_mode' value={mode} />
                    <i
                      className={utils.classNames({
                        glyphicon: true,
                        'glyphicon-th-list': mode === 'standard',
                        'glyphicon-compact': mode === 'compact'
                      })}
                    />
                  </label>
                </Tooltip>
              );
            })}
          </div>
        </div>
        {_.some(availableBondingTypes, (bondingTypes) => bondingTypes.length) &&
          !configurationTemplateExists &&
          !locked && [
            <div className='bonding-buttons-box text-right col-xs-8' key='bond-actions'>
              <div className='btn-group'>
                <button
                  className='btn btn-default btn-bond'
                  onClick={() => this.bondInterfaces(bondType)}
                  disabled={!bondingPossible}
                >
                  {i18n(ns + 'bond_button')}
                </button>
                <button
                  className='btn btn-default btn-unbond'
                  onClick={this.unbondInterfaces}
                  disabled={!unbondingPossible}
                >
                  {i18n(ns + 'unbond_button')}
                </button>
              </div>
            </div>,
            <div className='col-xs-12' key='bonds-warnings'>
              {!bondingPossible && checkedInterfaces.concat(checkedBonds).length > 1 &&
                <div className='alert alert-warning'>
                  {i18n(ns + (
                    checkedBonds.length > 1 ?
                    'several_bonds_warning' :
                    'interfaces_cannot_be_bonded'
                  ))}
                </div>}

              {invalidSpeedsForBonding &&
                <div className='alert alert-warning'>
                  {i18n(ns + 'bond_speed_warning')}
                </div>}
            </div>
          ]}
        <div className='ifc-list col-xs-12'>
          {interfaces.map((ifc, index) => {
            var ifcName = ifc.get('name');
            var initialIfcData = _.find(initialInterfaces, {name: ifcName});
            var limitations = this.state.limitations[ifc.isBond() ? ifcName : ifc.id];

            return !_.includes(slaveInterfaceNames, ifcName) && (
              <NodeInterfaceDropTarget
                {... _.pick(this.props, 'cluster', 'nodes', 'interfaces', 'configModels')}
                {... _.pick(this,
                  'validate', 'removeInterfaceFromBond', 'getAvailableBondingTypes'
                )}
                {...{viewMode, limitations, locked, configurationTemplateExists}}
                key={'interface-' + ifcName}
                interface={ifc}
                hasChanges={!_.isEqual(initialIfcData, _.omit(ifc.toJSON(), 'state'))}
                errors={interfacesErrors[ifcName]}
                bondingProperties={bondingConfig.properties}
                availableBondingTypes={availableBondingTypes[ifcName]}
                nodesInterfaces={nodesInterfaces[index]}
                interfaceSpeeds={interfaceSpeeds[index]}
                interfaceNames={interfaceNames[index]}
                settingSectionKey={this.state.settingSectionKey}
                initialAttributes={initialIfcData.attributes}
                configModels={_.extend({}, configModels, {
                  attributes: ifc.get('attributes'),
                  default: ifc.get('attributes')
                })}
              />
            );
          })}
        </div>
        <div className='col-xs-12 page-buttons content-elements'>
          <div className='well clearfix'>
            <div className='btn-group'>
              <Link
                className='btn btn-default'
                to={'/cluster/' + cluster.id + '/nodes'}
                disabled={!!actionInProgress}
              >
                {i18n('cluster_page.nodes_tab.back_to_nodes_button')}
              </Link>
            </div>
            {!locked &&
              <div className='btn-group pull-right'>
                <ProgressButton
                  className='btn btn-default btn-defaults'
                  onClick={this.loadDefaults}
                  disabled={!loadDefaultsEnabled}
                  progress={actionInProgress === 'load_defaults'}
                >
                  {i18n('common.load_defaults_button')}
                </ProgressButton>
                <button
                  className='btn btn-default btn-revert-changes'
                  onClick={this.revertChanges}
                  disabled={!revertChangesEnabled}
                >
                  {i18n('common.cancel_changes_button')}
                </button>
                <ProgressButton
                  className='btn btn-success btn-apply'
                  onClick={this.applyChanges}
                  disabled={!this.isSavingPossible()}
                  progress={actionInProgress === 'apply_changes'}
                >
                  {i18n('common.apply_button')}
                </ProgressButton>
              </div>
            }
          </div>
        </div>
      </div>
    );
  }
});

var ErrorScreen = React.createClass({
  render() {
    var {nodes, cluster, nodesByNetworksMap} = this.props;
    return (
      <div className='ifc-management-panel row'>
        <div className='title'>
          {i18n(
            ns + 'read_only_title',
            {count: nodes.length, name: nodes.map('name').join(', ')}
          )}
        </div>
        {_.size(nodesByNetworksMap) > 1 &&
          <div className='col-xs-12'>
            <div className='alert alert-danger different-networks-alert'>
              {i18n(ns + 'nodes_have_different_networks')}
              {_.map(nodesByNetworksMap, (nodeIds, networkNames) => {
                return (
                  <Link
                    key={networkNames}
                    className='no-leave-check'
                    to={
                      '/cluster/' + cluster.id + '/nodes/interfaces/' +
                      utils.serializeTabOptions({nodes: nodeIds})
                    }
                  >
                    {i18n(ns + 'node_networks', {
                      count: nodeIds.length,
                      networks: _.map(networkNames.split(','), (name) => i18n('network.' + name))
                        .join(', ')
                    })}
                  </Link>
                );
              })}
            </div>
          </div>
        }
        <div className='col-xs-12 page-buttons content-elements'>
          <div className='well clearfix'>
            <div className='btn-group'>
              <Link
                className='btn btn-default'
                to={'/cluster/' + cluster.id + '/nodes'}
              >
                {i18n('cluster_page.nodes_tab.back_to_nodes_button')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
});

var NodeInterface = React.createClass({
  mixins: [
    backboneMixin('interface'),
    backboneMixin({
      modelOrCollection(props) {
        return props.interface.get('attributes');
      }
    }),
    backboneMixin({
      modelOrCollection(props) {
        return props.interface.get('assigned_networks');
      }
    })
  ],
  statics: {
    target: {
      drop(props, monitor) {
        var targetInterface = props.interface;
        var sourceInterface = props.interfaces.find({name: monitor.getItem().interfaceName});
        var network = sourceInterface.get('assigned_networks')
          .find({name: monitor.getItem().networkName});
        sourceInterface.get('assigned_networks').remove(network);
        targetInterface.get('assigned_networks').add(network);
        // trigger 'change' event to update screen buttons state
        targetInterface.trigger('change', targetInterface);
      },
      canDrop(props, monitor) {
        return monitor.getItem().interfaceName !== props.interface.get('name');
      }
    },
    collect(connect, monitor) {
      return {
        connectDropTarget: connect.dropTarget(),
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop()
      };
    }
  },
  getDefaultProps() {
    return {
      bondAttributeNames: ['mode', 'lacp', 'lacp_rate', 'xmit_hash_policy', 'type']
    };
  },
  componentDidUpdate() {
    //this.props.validate();
  },
  isLacpRateAvailable() {
    return _.includes(
      this.getBondPropertyValues('lacp_rate', 'for_modes'),
      this.getBondMode()
    );
  },
  isHashPolicyNeeded() {
    return _.includes(
      this.getBondPropertyValues('xmit_hash_policy', 'for_modes'),
      this.getBondMode()
    );
  },
  getBondMode() {
    return this.props.interface.get('mode') ||
      this.props.interface.get('attributes').get('mode.value.value');
  },
  getAvailableBondingModes() {
    var {configModels, bondingProperties} = this.props;
    var ifc = this.props.interface;
    var bondType = ifc.get('attributes').get('type__.value');
    var modes = (bondingProperties[bondType] || {}).mode;

    var availableModes = [];
    var interfaces = ifc.isBond() ? ifc.getSlaveInterfaces() : [ifc];
    _.each(interfaces, (ifc) => {
      availableModes.push(_.reduce(modes, (result, modeSet) => {
        if (
          modeSet.condition &&
          !(
            new Expression(modeSet.condition, configModels, {strict: false})
          ).evaluate({interface: ifc})
        ) return result;
        return result.concat(modeSet.values);
      }, []));
    });
    return _.intersection(...availableModes);
  },
  getBondPropertyValues(propertyName, value) {
    var bondType = this.props.interface.get('attributes').get('type__.value');
    return _.flatten(_.map((this.props.bondingProperties[bondType] || {})[propertyName], value));
  },
  updateBondAttributes(path, value) {
    var attributes = this.props.interface.get('attributes');
    attributes.set(path, value);
    if (!this.isHashPolicyNeeded()) attributes.unset('xmit_hash_policy.value');
    if (!this.isLacpRateAvailable()) attributes.unset('lacp_rate.value');
  },
  bondingChanged(name, checked) {
    this.props.interface.set({checked});
  },
  bondingModeChanged(name, mode) {
    this.props.interface.set({mode});
    this.updateBondAttributes('mode.value.value', mode);
    if (this.isHashPolicyNeeded()) {
      this.updateBondAttributes(
        'xmit_hash_policy.value.value',
        this.getBondPropertyValues('xmit_hash_policy', 'values')[0]
      );
    }
    if (this.isLacpRateAvailable()) {
      this.updateBondAttributes(
        'lacp_rate.value.value',
        this.getBondPropertyValues('lacp_rate', 'values')[0]
      );
    }
  },
  onPolicyChange(name, value) {
    this.updateBondAttributes('xmit_hash_policy.value.value', value);
  },
  onLacpChange(name, value) {
    this.updateBondAttributes('lacp_rate.value.value', value);
  },
  getBondingOptions(bondingModes, attributeName) {
    return _.map(bondingModes, (mode) => {
      return (
        <option key={'option-' + mode} value={mode}>
          {i18n(ns + attributeName + '.' + mode.replace('.', '_'), {defaultValue: mode})}
        </option>
      );
    });
  },
  checkRestrictions(action, setting) {
    return this.props.interface.get('attributes')
      .checkRestrictions(this.props.configModels, action, setting);
  },
  render() {
    var {interface: ifc, cluster, nodes, locked, availableBondingTypes, bondAttributeNames,
      configurationTemplateExists, viewMode,
      interfaceSpeeds, interfaceNames, errors} = this.props;
    var isBond = ifc.isBond();
    var availableBondingModes = isBond ? this.getAvailableBondingModes() : [];
    var networkConfiguration = cluster.get('networkConfiguration');
    var networks = networkConfiguration.get('networks');
    var networkingParameters = networkConfiguration.get('networking_parameters');
    var slaveInterfaces = ifc.getSlaveInterfaces();
    var assignedNetworks = ifc.get('assigned_networks');
    var connectionStatusClasses = (ifc) => {
      var isInterfaceDown = ifc.get('state') === 'down';
      return {
        'ifc-connection-status': true,
        'ifc-online': !isInterfaceDown,
        'ifc-offline': isInterfaceDown
      };
    };
    var attributes = ifc.get('attributes');
    var meta = ifc.get('meta') || {};
    var renderableSections = _.chain(_.keys(attributes.attributes))
      .without(bondAttributeNames) // some bond attributes are not visible in tabbed interface
      .filter((sectionName) => {
        // interface attribute settings should be available (defined in the interface metadata)
        return (!meta[sectionName] || meta[sectionName].available) &&
          // and aren't hidden by restrictions
          !this.checkRestrictions(
            'hide',
            attributes.get(utils.makePath(sectionName, 'metadata'))
          ).result;
      })
      .sortBy(
        (sectionName) => attributes.get(utils.makePath(sectionName, 'metadata', 'weight'))
      )
      .value();

    var bondingPossible = !!availableBondingTypes.length && !configurationTemplateExists && !locked;
    var networkErrors = (_.flatten((errors || {}).network_errors || [])).join(', ');
    var isCompact = viewMode === 'compact';
    var visibleErrors = _.compact([
      networkErrors,
      !_.isNull(attributes.validationError) && isCompact && i18n(ns + 'interface_properties_errors')
    ]);
    var checkbox = bondingPossible ?
      <Input
        type='checkbox'
        label={!isCompact && ifc.get('name')}
        onChange={this.bondingChanged}
        checked={!!ifc.get('checked')}
      />
    :
      !isCompact && ifc.get('name');

    return this.props.connectDropTarget(
      <div className='ifc-container'>
        <div
          className={utils.classNames({
            'ifc-inner-container': true,
            nodrag: !!networkErrors,
            over: this.props.isOver && this.props.canDrop,
            'has-changes': this.props.hasChanges,
            [ifc.get('name')]: true,
            [viewMode]: true
          })}
        >
          {!isCompact &&
            <div className='ifc-header forms-box clearfix'>
              <div className={utils.classNames({
                'common-ifc-name pull-left': true,
                'no-checkbox': !bondingPossible
              })}>
                {checkbox}
              </div>
              {isBond && [
                <Input
                  key='bonding_mode'
                  type='select'
                  disabled={!bondingPossible}
                  onChange={this.bondingModeChanged}
                  value={this.getBondMode()}
                  label={i18n(ns + 'bonding_mode')}
                  children={this.getBondingOptions(availableBondingModes, 'bonding_modes')}
                  wrapperClassName='pull-right'
                />,
                this.isHashPolicyNeeded() &&
                  <Input
                    key='bonding_policy'
                    type='select'
                    value={attributes.get('xmit_hash_policy.value.value')}
                    disabled={!bondingPossible}
                    onChange={this.onPolicyChange}
                    label={i18n(ns + 'bonding_policy')}
                    children={this.getBondingOptions(
                      this.getBondPropertyValues('xmit_hash_policy', 'values'),
                      'hash_policy'
                    )}
                    wrapperClassName='pull-right'
                  />,
                this.isLacpRateAvailable() &&
                  <Input
                    key='lacp_rate'
                    type='select'
                    value={attributes.get('lacp_rate.value.value')}
                    disabled={!bondingPossible}
                    onChange={this.onLacpChange}
                    label={i18n(ns + 'lacp_rate')}
                    children={this.getBondingOptions(
                      this.getBondPropertyValues('lacp_rate', 'values'),
                      'lacp_rates'
                    )}
                    wrapperClassName='pull-right'
                  />
              ]}
            </div>
          }
          <div className={utils.classNames({
            'networks-block': true,
            'col-xs-12': isCompact
          })}>
            <div className='row'>
              <div className='col-xs-3'>
                <div className='ifc-select pull-left'>
                  {isCompact && checkbox}
                  {_.map(isCompact ? [ifc] : slaveInterfaces, (renderedInterface, index) => {
                    return (
                      <div
                        key={'info-' + renderedInterface.get('name')}
                        className='ifc-info-block clearfix'
                        >
                        <div className='ifc-connection pull-left'>
                          <div className={utils.classNames(
                            connectionStatusClasses(renderedInterface)
                          )}></div>
                        </div>
                        <div className={utils.classNames({
                          'ifc-info pull-left': true,
                          'ifc-compact': isCompact && !isBond
                        })}>
                          {(isBond || isCompact) &&
                            <div>
                              {i18n(ns + 'name')}:
                              {' '}
                              <span className='ifc-name'>
                                {isCompact ? ifc.get('name') : interfaceNames[index]}
                              </span>
                            </div>
                          }
                          {isCompact ?
                            isBond &&
                              <div>
                                {i18n(ns + 'slaves')}:
                                {' '}
                                <span className='slaves-names'>
                                  {_.take(interfaceNames, 2).join(', ')}
                                  {interfaceNames.length > 2 && ', ...'}
                                </span>
                              </div>
                            :
                              ([
                                nodes.length === 1 &&
                                  <div key='mac'>
                                    {i18n(ns + 'mac')}: {renderedInterface.get('mac')}
                                  </div>,
                                <div key='speed'>
                                  {i18n(ns + 'speed')}: {interfaceSpeeds[index].join(', ')}
                                </div>,
                                (bondingPossible && slaveInterfaces.length >= 3) &&
                                  <button
                                    key='remove_from_bond'
                                    className='btn btn-link'
                                    onClick={_.partial(
                                          this.props.removeInterfaceFromBond,
                                          ifc.get('name'), renderedInterface.get('name')
                                        )}
                                    >
                                    {i18n('common.remove_button')}
                                  </button>
                              ])
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className='col-xs-9'>
                {!configurationTemplateExists &&
                  <div className='ifc-networks'>
                    {assignedNetworks.length ?
                      assignedNetworks.map((interfaceNetwork) => {
                        var network = interfaceNetwork.getFullNetwork(networks);
                        if (!network) return null;
                        return (
                          <DraggableNetwork
                            key={'network-' + network.id}
                            {... _.pick(this.props, ['locked', 'interface'])}
                            networkingParameters={networkingParameters}
                            interfaceNetwork={interfaceNetwork}
                            network={network}
                          />
                        );
                      })
                    :
                      <div className='no-networks'>
                        {i18n(ns + 'drag_and_drop_description')}
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
            {!!visibleErrors.length &&
              <div className='ifc-error alert alert-danger'>
                {_.map(visibleErrors, (error, index) => <p key={'error' + index}>{error}</p>)}
              </div>
            }
          </div>
          {!isCompact ?
            <NodeInterfaceAttributes
              {... _.pick(this.props, 'cluster', 'interface', 'nodesInterfaces',
                'limitations', 'locked', 'bondingProperties', 'validate', 'settingSectionKey',
                'getAvailableBondingTypes', 'configModels', 'initialAttributes')}
              {... _.pick(this, 'checkRestrictions', 'bondingModeChanged')}
              {...{attributes, renderableSections}}
              errors={(errors|| {}).attributes || null}
              isMassConfiguration={!!nodes.length}
            />
            :
            <div className='clearfix'></div>
          }
        </div>
      </div>
    );
  }
});

var NodeInterfaceDropTarget = DropTarget(
  'network',
  NodeInterface.target,
  NodeInterface.collect
)(NodeInterface);

var Network = React.createClass({
  statics: {
    source: {
      beginDrag(props) {
        return {
          networkName: props.network.get('name'),
          interfaceName: props.interface.get('name')
        };
      },
      canDrag(props) {
        return !(props.locked || props.network.get('meta').unmovable);
      }
    },
    collect(connect, monitor) {
      return {
        connectDragSource: connect.dragSource(),
        isDragging: monitor.isDragging()
      };
    }
  },
  render() {
    var network = this.props.network;
    var interfaceNetwork = this.props.interfaceNetwork;
    var networkingParameters = this.props.networkingParameters;
    var classes = {
      'network-block pull-left': true,
      disabled: !this.constructor.source.canDrag(this.props),
      dragging: this.props.isDragging
    };
    var vlanRange = network.getVlanRange(networkingParameters);

    return this.props.connectDragSource(
      <div className={utils.classNames(classes)}>
        <div className='network-name'>
          {i18n(
            'network.' + interfaceNetwork.get('name'),
            {defaultValue: interfaceNetwork.get('name')}
          )}
        </div>
        {vlanRange &&
          <div className='vlan-id'>
            {i18n(ns + 'vlan_id', {count: _.uniq(vlanRange).length})}:
            {_.uniq(vlanRange).join('-')}
          </div>
        }
      </div>
    );
  }
});

var DraggableNetwork = DragSource('network', Network.source, Network.collect)(Network);

var NodeInterfaceAttributes = React.createClass({
  assignConfigurationPanelEvents() {
    $(ReactDOM.findDOMNode(this.refs['configuration-panel']))
      .on('show.bs.collapse', () => this.setState({pendingToggle: false, collapsed: false}))
      .on('hide.bs.collapse', () => this.setState({pendingToggle: false, collapsed: true}));
  },
  componentDidMount() {
    this.assignConfigurationPanelEvents();
  },
  componentDidUpdate() {
    if (this.state.pendingToggle) {
      $(ReactDOM.findDOMNode(this.refs['configuration-panel'])).collapse('toggle');
    }
  },
  getInitialState() {
    return {
      activeInterfaceSectionName: null,
      pendingToggle: false,
      collapsed: true
    };
  },
  switchActiveSubtab(sectionName) {
    var currentActiveTab = this.state.activeInterfaceSectionName;
    this.setState({
      pendingToggle: _.isNull(currentActiveTab) ||
        currentActiveTab === sectionName || this.state.collapsed,
      activeInterfaceSectionName: sectionName
    });
  },
  makeOffloadingModesExcerpt() {
    var {interface: ifc, attributes} = this.props;
    var stateLabels = {
      true: i18n('common.enabled'),
      false: i18n('common.disabled'),
      null: i18n('common.default')
    };

    var offloadingModes = ifc.get('meta').offloading_modes || [];
    var offloadingModeStates = attributes.get('offloading.modes.value');

    if (_.uniq(_.values(offloadingModeStates)).length === 1) {
      return states[_.values(offloadingModeStates)[0]];
    }

    var lastState;
    var added = 0;
    var excerpt = [];
    _.each(offloadingModes,
        ({name}) => {
          var state = offloadingModeStates[name];
          if (!_.isNull(state) && state !== lastState) {
            lastState = state;
            added++;
            excerpt.push((added > 1 ? ',' : '') + name + ' ' + stateLabels[lastState]);
          }
          // show no more than two modes in the button
          return added <= 2;
        }
    );
    if (added < offloadingModes.length) excerpt.push(', ...');
    return excerpt;
  },
  changeBondType(newType) {
    var {attributes, bondingProperties, bondingModeChanged} = this.props;
    attributes.set('type__.value', newType);
    var newMode = _.flatten(_.map(bondingProperties[newType].mode, 'values'))[0];
    bondingModeChanged(null, newMode);
  },
  getSectionDefaultSettingValue(section) {
    var {attributes, configModels} = this.props;

    var defaultSetting;
    _.each(section, (setting, settingName) => {
      var isVisible = attributes.isSettingVisible(setting, settingName, configModels);
      if (isVisible) defaultSetting = setting;
      return !isVisible;
    });
    var {name, value} = defaultSetting;

    if (_.isBoolean(value)) {
      if (name === 'disabled') value = !value; // 'disabled' setting name inverts bool logic
      return value ? i18n('common.enabled') : i18n('common.disabled');
    }
    if (_.isNull(value) || value === '') return i18n('common.default');
    if (_.isString(value)) return value;
    return null;
  },
  renderConfigurableSections() {
    var {attributes, limitations, renderableSections} = this.props;
    var {activeInterfaceSectionName, collapsed} = this.state;
    return (
      <div className='properties-list'>
        {_.map(renderableSections, (sectionName) => {
          var section = attributes.get(sectionName);
          var {metadata = {}} = section;
          var isRestricted = !(limitations[sectionName] || {}).equal;
          var sectionClasses = {
            'property-item-container': true,
            sectionName: true,
            active: sectionName === activeInterfaceSectionName && !collapsed
          };
          var valueLabel = sectionName === 'offloading' ?
            this.makeOffloadingModesExcerpt() : this.getSectionDefaultSettingValue(section);
          return (
            <span key={metadata.label} className={utils.classNames(sectionClasses)}>
              {isRestricted &&
                <Tooltip text={i18n(ns + 'availability_tooltip')}>
                  <span className='glyphicon glyphicon-lock' aria-hidden='true' />
                </Tooltip>
              }
              {metadata.label || sectionName}:
              <button
                className={utils.classNames({
                  'btn btn-link property-item': true,
                  'text-danger': _.some(attributes.validationError,
                    (error, key) => _.startsWith(key, sectionName + '.')
                  )
                })}
                onClick={() => this.switchActiveSubtab(sectionName)}
                disabled={isRestricted}
              >
                {isRestricted ? i18n(ns + 'different_availability') : valueLabel}
              </button>
            </span>
          );
        })
        }
      </div>
    );
  },
  renderInterfaceSubtab() {
    var sectionName = this.state.activeInterfaceSectionName;
    var {
      interface: ifc, attributes, configModels, validate, settingSectionKey, errors
    } = this.props;

    if (sectionName === 'offloading') {
      return (
        <OffloadingModesSubtab
          {..._.pick(this.props, 'locked', 'interface', 'attributes', 'validate')}
          errors={errors[sectionName]}
          offloadingModes={ifc.get('meta').offloading_modes || []}
        />
      );
    }

    var settingsToDisplay = _.compact(
      _.map(attributes.get(sectionName), (setting, settingName) =>
        attributes.isSettingVisible(setting, settingName, configModels) && settingName
      )
    );

    return (
      <div className={utils.classNames('forms-box', 'attributes', sectionName + '-section')}>
        <SettingSection
          {... {sectionName, settingsToDisplay, configModels}}
          {... _.pick(this.props, 'cluster', 'checkRestrictions', 'initialAttributes')}
          key={settingSectionKey}
          showHeader={false}
          getValueAttribute={() => 'value'}
          onChange={(settingName, value) => {
            value = _.isNaN(value) ? null : value;
            attributes.set(utils.makePath(sectionName, settingName, 'value'), value);
            validate();
            ifc.trigger('change', ifc);
          }}
          settings={attributes}
        />
      </div>
    );
  },
  render() {
    var {activeInterfaceSectionName, collapsed} = this.state;
    var {renderableSections, limitations} = this.props;

    var isConfigurationModeOn = !_.isNull(activeInterfaceSectionName);
    var toggleConfigurationPanelClasses = utils.classNames({
      'glyphicon glyphicon-menu-down': true,
      rotate: !collapsed
    });
    var defaultSubtab = _.find(renderableSections, (sectioName) => limitations[sectioName].equal);

    return (
      <div className='ifc-properties clearfix'>
        <div className='row'>
          <div className='col-xs-11'>
            {this.renderConfigurableSections()}
          </div>
          <div className='col-xs-1 toggle-configuration-control'>
            <i
              className={toggleConfigurationPanelClasses}
              onClick={() => this.switchActiveSubtab(
                isConfigurationModeOn ? activeInterfaceSectionName : defaultSubtab
              )}
            />
          </div>
        </div>
        {activeInterfaceSectionName &&
          <div className='row configuration-panel collapse' ref='configuration-panel'>
            <div className='col-xs-12 interface-sub-tab'>
              {this.renderInterfaceSubtab()}
            </div>
          </div>
        }
      </div>
    );
  }
});

var OffloadingModesSubtab = React.createClass({
  toggleOffloading(name, value) {
    var {interface: ifc, attributes, validate} = this.props;
    attributes.set('offloading.disable.value', value);
    validate();
    ifc.trigger('change', ifc);
  },
  render() {
    var {attributes, locked} = this.props;
    return (
      <div className='forms-box'>
        {_.size(attributes.get('offloading.modes.value')) ?
          <OffloadingModes
            {... _.pick(this.props, 'attributes', 'offloadingModes', 'locked')}
          />
          :
          <Input
            type='checkbox'
            label={i18n(ns + 'offloading.disable_offloading')}
            checked={attributes.get('offloading.disable.value')}
            name='disable'
            onChange={this.toggleOffloading}
            disabled={locked}
            wrapperClassName='toggle-offloading'
          />
        }
      </div>
    );
  }
});

export default EditNodeInterfacesScreen;
