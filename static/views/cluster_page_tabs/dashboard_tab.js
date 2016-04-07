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
import i18n from 'i18n';
import React from 'react';
import ReactDOM from 'react-dom';
import utils from 'utils';
import models from 'models';
import dispatcher from 'dispatcher';
import {Input, ProgressBar, Tooltip} from 'views/controls';
import {
  DiscardClusterChangesDialog, DeployClusterDialog, ProvisionVMsDialog, ProvisionNodesDialog,
  DeployNodesDialog, RemoveClusterDialog, ResetEnvironmentDialog, StopDeploymentDialog,
  SelectNodesDialog
} from 'views/dialogs';
import {backboneMixin, pollingMixin, renamingMixin} from 'component_mixins';

var ns = 'cluster_page.dashboard_tab.';

var DashboardTab = React.createClass({
  mixins: [
    // this is needed to somehow handle the case when verification
    // is in progress and user pressed Deploy
    backboneMixin({
      modelOrCollection: (props) => props.cluster.get('tasks'),
      renderOn: 'update change'
    }),
    backboneMixin({
      modelOrCollection: (props) => props.cluster.get('nodes'),
      renderOn: 'update change'
    }),
    backboneMixin({
      modelOrCollection: (props) => props.cluster.get('pluginLinks'),
      renderOn: 'update change'
    }),
    backboneMixin({
      modelOrCollection: (props) => props.cluster.get('networkConfiguration')
    }),
    backboneMixin('cluster', 'change'),
    pollingMixin(20, true)
  ],
  statics: {
    breadcrumbsPath() {
      return [
        [i18n('cluster_page.tabs.dashboard'), null, {active: true}]
      ];
    }
  },
  fetchData() {
    return this.props.cluster.get('nodes').fetch();
  },
  render() {
    var cluster = this.props.cluster;
    var release = cluster.get('release');
    var runningDeploymentTask = cluster.task({group: 'deployment', active: true});
    var finishedDeploymentTask = cluster.task({group: 'deployment', active: false});
    var dashboardLinks = [{
      url: '/',
      title: i18n(ns + 'horizon'),
      description: i18n(ns + 'horizon_description')
    }].concat(
      cluster.get('pluginLinks').invoke('pick', 'url', 'title', 'description')
    );

    return (
      <div className='wrapper'>
        {release.get('state') === 'unavailable' &&
          <div className='alert alert-warning'>
            {i18n('cluster_page.unavailable_release', {name: release.get('name')})}
          </div>
        }
        {cluster.get('is_customized') &&
          <div className='alert alert-warning'>
            {i18n('cluster_page.cluster_was_modified_from_cli')}
          </div>
        }
        {runningDeploymentTask ?
          <DeploymentInProgressControl
            cluster={cluster}
            task={runningDeploymentTask}
          />
        :
          [
            finishedDeploymentTask &&
              <DeploymentResult
                key='task-result'
                cluster={cluster}
                task={finishedDeploymentTask}
              />,
            <ClusterActionsPanel
              key='actions-panel'
              cluster={cluster}
            />,
            cluster.get('status') === 'operational' &&
              <DashboardLinks
                key='plugin-links'
                cluster={cluster}
                links={dashboardLinks}
              />
          ]
        }
        <ClusterInfo cluster={cluster} />
        <DocumentationLinks />
      </div>
    );
  }
});

var DashboardLinks = React.createClass({
  renderLink(link) {
    var {links, cluster} = this.props;
    return (
      <DashboardLink
        {...link}
        className={links.length > 1 ? 'col-xs-6' : 'col-xs-12'}
        cluster={cluster}
      />
    );
  },
  render() {
    var {links} = this.props;
    if (!links.length) return null;
    return (
      <div className='row'>
        <div className='dashboard-block links-block clearfix'>
          <div className='col-xs-12'>
            {links.map((link, index) => {
              if (index % 2 === 0) {
                return (
                  <div className='row' key={link.url}>
                    {this.renderLink(link)}
                    {index + 1 < links.length && this.renderLink(links[index + 1])}
                  </div>
                );
              }
            }, this)}
          </div>
        </div>
      </div>
    );
  }
});

var DashboardLink = React.createClass({
  propTypes: {
    title: React.PropTypes.string.isRequired,
    url: React.PropTypes.string.isRequired,
    description: React.PropTypes.node,
    className: React.PropTypes.node
  },
  render() {
    var {url, title, description, className, cluster} = this.props;

    var isSSLEnabled = cluster.get('settings').get('public_ssl.horizon.value');
    var isURLRelative = !(/^(?:https?:)?\/\//.test(url));

    var httpsLink = 'https://' + cluster.get('settings').get('public_ssl.hostname.value') + url;
    var httpLink = 'http://' + cluster.get('networkConfiguration').get('public_vip') + url;

    return (
      <div className={utils.classNames('link-block', className)}>
        <div className='title'>
          {isURLRelative ?
            isSSLEnabled ?
              [
                <a key='link' href={httpsLink} target='_blank'>{title}</a>,
                <a key='http-link' href={httpLink} className='http-link' target='_blank'>
                  {i18n(ns + 'http_plugin_link')}
                </a>
              ]
            :
              <a href={httpLink} target='_blank'>{title}</a>
          :
            <a href={url} target='_blank'>{title}</a>
          }
        </div>
        <div className='description'>{description}</div>
      </div>
    );
  }
});

var DeploymentInProgressControl = React.createClass({
  render() {
    var task = this.props.task;
    var showStopButton = task.match({name: 'deploy'});
    return (
      <div className='row'>
        <div className='dashboard-block clearfix'>
          <div className='col-xs-12'>
            <div className={utils.classNames({
              'deploy-process': true,
              [task.get('name')]: true,
              'has-stop-control': showStopButton
            })}>
              <h4>
                <strong>
                  {i18n(ns + 'current_task') + ' '}
                </strong>
                {i18n('cluster_page.' + task.get('name')) + '...'}
              </h4>
              <ProgressBar progress={task.isInfinite() ? null : task.get('progress')} />
              {showStopButton &&
                <Tooltip text={i18n('cluster_page.stop_deployment_button')}>
                  <button
                    className='btn btn-danger btn-xs pull-right stop-deployment-btn'
                    onClick={() => StopDeploymentDialog.show({cluster: this.props.cluster})}
                    disabled={!task.isStoppable()}
                  >
                    {i18n(ns + 'stop')}
                  </button>
                </Tooltip>
              }
            </div>
          </div>
        </div>
      </div>
    );
  }
});

var DeploymentResult = React.createClass({
  getInitialState() {
    return {collapsed: false};
  },
  dismissTaskResult() {
    var {task, cluster} = this.props;
    if (task.match({name: 'deploy'})) {
      // deletion of 'deploy' task does not invoke all deployment tasks
      // deletion on the backend anymore

      _.invoke(cluster.tasks({group: 'deployment', active: false}), 'destroy');
    } else {
      task.destroy();
    }
  },
  componentDidMount() {
    $('.result-details', ReactDOM.findDOMNode(this))
      .on('show.bs.collapse', this.setState.bind(this, {collapsed: true}, null))
      .on('hide.bs.collapse', this.setState.bind(this, {collapsed: false}, null));
  },
  render() {
    var {task} = this.props;
    var error = task.match({status: 'error'});
    var delimited = task.escape('message').split('\n\n');
    var summary = delimited.shift();
    var details = delimited.join('\n\n');
    var warning = task.match({name: ['reset_environment', 'stop_deployment']});
    var classes = {
      alert: true,
      'alert-warning': warning,
      'alert-danger': !warning && error,
      'alert-success': !warning && !error
    };
    return (
      <div className={utils.classNames(classes)}>
        <button className='close' onClick={this.dismissTaskResult}>&times;</button>
        <strong>{i18n('common.' + (error ? 'error' : 'success'))}</strong>
        <br />
        <span dangerouslySetInnerHTML={{__html: utils.urlify(summary)}} />
        <div className={utils.classNames({'task-result-details': true, hidden: !details})}>
          <pre
            className='collapse result-details'
            dangerouslySetInnerHTML={{__html: utils.urlify(details)}}
          />
          <button className='btn-link' data-toggle='collapse' data-target='.result-details'>
            {this.state.collapsed ? i18n('cluster_page.hide_details_button') :
              i18n('cluster_page.show_details_button')}
          </button>
        </div>
      </div>
    );
  }
});

var DocumentationLinks = React.createClass({
  renderDocumentationLinks(link, labelKey) {
    return (
      <div className='documentation-link' key={labelKey}>
        <span>
          <i className='glyphicon glyphicon-list-alt' />
          <a href={link} target='_blank'>
            {i18n(ns + labelKey)}
          </a>
        </span>
      </div>
    );
  },
  render() {
    return (
      <div className='row content-elements'>
        <div className='title'>{i18n(ns + 'documentation')}</div>
        <div className='col-xs-12'>
          <p>{i18n(ns + 'documentation_description')}</p>
        </div>
        <div className='documentation col-xs-12'>
          {this.renderDocumentationLinks('http://docs.openstack.org/', 'openstack_documentation')}
          {this.renderDocumentationLinks(
            'https://wiki.openstack.org/wiki/Fuel/Plugins',
            'plugin_documentation'
          )}
        </div>
      </div>
    );
  }
});

var ClusterActionsPanel = React.createClass({
  getDefaultProps() {
    return {
      actions: ['spawn_vms', 'deploy', 'provision', 'deployment']
    };
  },
  getInitialState() {
    return {
      currentAction: this.isActionAvailable('spawn_vms') ? 'spawn_vms' : 'deploy'
    };
  },
  getConfigModels() {
    var {cluster} = this.props;
    return {
      cluster,
      settings: cluster.get('settings'),
      version: app.version,
      release: cluster.get('release'),
      default: cluster.get('settings'),
      networking_parameters: cluster.get('networkConfiguration').get('networking_parameters')
    };
  },
  validate(action) {
    return _.reduce(
      this.validations(action),
      (accumulator, validator) => _.merge(
        accumulator,
        validator.call(this, this.props.cluster),
        (a, b) => a.concat(_.compact(b))
      ),
      {blocker: [], error: [], warning: []}
    );
  },
  validations(action) {
    switch (action) {
      case 'deploy':
        return [
          // check for unprovisioned virt nodes
          function(cluster) {
            var unprovisionedVirtNodes = cluster.get('nodes').filter(
              (node) => node.hasRole('virt') && node.get('status') === 'discover'
            );
            if (unprovisionedVirtNodes.length) {
              return {
                blocker: [
                  i18n(ns + 'unprovisioned_virt_nodes', {
                    role: cluster.get('roles').find({name: 'virt'}).get('label'),
                    count: unprovisionedVirtNodes.length
                  })
                ]
              };
            }
          },
          // check for offline nodes
          function(cluster) {
            var offlineNodes = cluster.get('nodes').where({online: false});
            if (offlineNodes.length) {
              return {
                blocker: [i18n(ns + 'offline_nodes', {count: offlineNodes.length})]
              };
            }
          },
          // check if TLS settings are not configured
          function(cluster) {
            var sslSettings = cluster.get('settings').get('public_ssl');
            if (!sslSettings.horizon.value && !sslSettings.services.value) {
              return {warning: [i18n(ns + 'tls_not_enabled')]};
            }
            if (!sslSettings.horizon.value) {
              return {warning: [i18n(ns + 'tls_for_horizon_not_enabled')]};
            }
            if (!sslSettings.services.value) {
              return {warning: [i18n(ns + 'tls_for_services_not_enabled')]};
            }
          },
          // check if deployment failed
          function(cluster) {
            return cluster.needsRedeployment() && {
              error: [
                <InstructionElement
                  key='unsuccessful_deploy'
                  description='unsuccessful_deploy'
                  link={{
                    url: 'operations.html#troubleshooting',
                    title: 'user_guide'
                  }}
                />
              ]
            };
          },
          // check VCenter settings
          function(cluster) {
            if (cluster.get('settings').get('common.use_vcenter.value')) {
              var vcenter = cluster.get('vcenter');
              vcenter.setModels(this.getConfigModels());
              return !vcenter.isValid() && {
                blocker: [
                  <span key='vcenter'>{i18n('vmware.has_errors') + ' '}
                    <a href={'/#cluster/' + cluster.id + '/vmware'}>
                      {i18n('vmware.tab_name')}
                    </a>
                  </span>
                ]
              };
            }
          },
          // check cluster settings
          function(cluster) {
            var settings = cluster.get('settings');
            settings.isValid({models: this.getConfigModels()});
            if (_.isNull(settings.validationError)) return {};

            var areOpenStackSettingsValid = true;
            var areNetworkSettingsValid = true;
            _.each(settings.validationError, (error, path) => {
              if (
                settings.get(utils.makePath(path.split('.')[0], 'metadata')).group === 'network' ||
                settings.get(path).group === 'network'
              ) {
                areNetworkSettingsValid = false;
              } else {
                areOpenStackSettingsValid = false;
              }
              return areOpenStackSettingsValid || areNetworkSettingsValid;
            });

            return {blocker: [
              !areOpenStackSettingsValid &&
                <span key='invalid_settings'>
                  {i18n(ns + 'invalid_settings')}
                  {' ' + i18n(ns + 'get_more_info') + ' '}
                  <a href={'#cluster/' + cluster.id + '/settings'}>
                    {i18n(ns + 'settings_link')}
                  </a>.
                </span>,
              !areNetworkSettingsValid &&
                <span key='invalid_network_settings'>
                  {i18n(ns + 'invalid_network_settings')}
                  {' ' + i18n(ns + 'get_more_info') + ' '}
                  <a href={'#cluster/' + cluster.id + '/network/network_settings'}>
                    {i18n(ns + 'network_settings_link')}
                  </a>.
                </span>
            ]};
          },
          // check node amount restrictions according to their roles
          function(cluster) {
            var configModels = this.getConfigModels();
            var roleModels = cluster.get('roles');
            var validRoleModels = roleModels.filter(
              (role) => !role.checkRestrictions(configModels).result
            );
            var limitValidations = _.zipObject(validRoleModels.map(
              (role) => [role.get('name'), role.checkLimits(configModels, cluster.get('nodes'))]
            ));
            var limitRecommendations = _.zipObject(validRoleModels.map(
              (role) => [
                role.get('name'),
                role.checkLimits(configModels, cluster.get('nodes'), true, ['recommended'])
              ]
            ));
            return {
              blocker: roleModels.map((role) => {
                var limits = limitValidations[role.get('name')];
                return limits && !limits.valid && limits.message;
              }),
              warning: roleModels.map((role) => {
                var recommendation = limitRecommendations[role.get('name')];
                return recommendation && !recommendation.valid && recommendation.message;
              })
            };
          },
          // check cluster network configuration
          function(cluster) {
            // network verification is not supported in multi-rack environment
            if (cluster.get('nodeNetworkGroups').length > 1) return null;

            var task = cluster.task('verify_networks');
            var makeComponent = (text, isError) => {
              var span = (
                <span key='invalid_networks'>
                  {text}
                  {' ' + i18n(ns + 'get_more_info') + ' '}
                  <a href={'#cluster/' + cluster.id + '/network/network_verification'}>
                    {i18n(ns + 'networks_link')}
                  </a>.
                </span>
              );
              return isError ? {error: [span]} : {warning: [span]};
            };

            if (_.isUndefined(task)) {
              return makeComponent(i18n(ns + 'verification_not_performed'));
            }
            if (task.match({status: 'error'})) {
              return makeComponent(i18n(ns + 'verification_failed'), true);
            }
            if (task.match({active: true})) {
              return makeComponent(i18n(ns + 'verification_in_progress'));
            }
          }
        ];
      default:
        return [];
    }
  },
  renderClusterChangeItem(changeName, nodes, showDeleteButton = true) {
    if (_.isArray(nodes) && !nodes.length) return null;
    var {cluster} = this.props;

    if (changeName === 'changed_configuration' && !cluster.isConfigurationChanged()) {
      return null;
    }

    return (
      <li className='changes-item'>
        {showDeleteButton &&
          <i
            className='btn btn-link btn-discard-changes discard-changes-icon'
            onClick={() => DiscardClusterChangesDialog.show({cluster, nodes, changeName})}
          />
        }
        {i18n(ns + changeName, {count: nodes && nodes.length}) + ''}
      </li>
    );
  },
  isActionAvailable(action) {
    var {cluster} = this.props;
    if (this.validate(action).blocker.length) return false;
    switch (action) {
      case 'deploy':
        return cluster.isDeploymentPossible();
      case 'provision':
        return cluster.get('nodes').any((node) => node.isProvisioningPossible());
      case 'deployment':
        return cluster.get('nodes').any((node) => node.isDeploymentPossible());
      case 'spawn_vms':
        return cluster.get('nodes').any((node) => {
          var status = node.get('status');
          return node.hasRole('virt') && (
            status === 'discover' ||
            status === 'error' && this.get('error_type') === 'provision'
          );
        });
      default:
        return true;
    }
  },
  toggleAction(action) {
    this.setState({currentAction: action});
  },
  renderActions() {
    var action = this.state.currentAction;
    var actionNs = ns + 'actions.' + action + '.';

    var {cluster} = this.props;
    var nodes = {
      provision: new models.Nodes(
        cluster.get('nodes').filter((node) => node.isProvisioningPossible())
      ),
      deployment: new models.Nodes(
        cluster.get('nodes').filter((node) => node.isDeploymentPossible())
      ),
      spawn_vms: new models.Nodes(
        cluster.get('nodes').filter(
          (node) => node.hasRole('virt') && node.get('status') === 'discover'
        )
      ),
      deploy: cluster.get('nodes')
    }[action];
    var offlineNodes = nodes.where({online: false});

    var alerts = this.validate(action);

    var blockerDescriptions = {
      deploy: <InstructionElement
        description='deployment_of_environment_cannot_be_started'
        isAlert
        link={{
          url: 'user-guide.html#add-nodes-ug',
          title: 'user_guide'
        }}
        explanation='for_more_information_roles'
      />
    };

    var actionButtonProps = {
      ns: actionNs,
      disabled: !this.isActionAvailable(action),
      nodes,
      cluster
    };

    var actionControls;
    switch (action) {
      case 'deploy':
        actionControls = [
          cluster.hasChanges() &&
            <ul key='cluster-changes'>
              {this.renderClusterChangeItem('added_node', nodes.where({pending_addition: true}))}
              {this.renderClusterChangeItem(
                'provisioned_node',
                nodes.where({pending_deletion: false, status: 'provisioned'}),
                false
              )}
              {this.renderClusterChangeItem(
                'stopped_node',
                nodes.where({status: 'stopped'}),
                false
              )}
              {this.renderClusterChangeItem('deleted_node', nodes.where({pending_deletion: true}))}
              {this.renderClusterChangeItem('changed_configuration')}
            </ul>,
          <ClusterActionButton
            {...actionButtonProps}
            key='action-button'
            nodes={nodes}
            className='deploy-btn'
            iconClassName='glyphicon glyphicon-deploy'
            warning={
              _.isEmpty(alerts.blocker) &&
              (!_.isEmpty(alerts.error) || !_.isEmpty(alerts.warning))
            }
            dialog={DeployClusterDialog}
          />
        ];
        break;
      case 'provision':
        actionControls = [
          !!nodes.length &&
            <ul key='node-changes'>
              <li>
                {i18n(actionNs + 'nodes_to_provision', {count: nodes.length})}
              </li>
              {!!offlineNodes.length &&
                <li>
                  {i18n(ns + 'offline_nodes', {count: offlineNodes.length})}
                </li>
              }
            </ul>,
          <ClusterActionButton
            {...actionButtonProps}
            key='action-button'
            className='btn-provision'
            dialog={ProvisionNodesDialog}
            canSelectNodes
            nodeStatusesToFilter={['pending_addition', 'error']}
          />
        ];
        break;
      case 'deployment':
        actionControls = [
          !!nodes.length &&
            <ul key='node-changes'>
              <li>
                {i18n(actionNs + 'nodes_to_deploy', {count: nodes.length})}
              </li>
              {!!offlineNodes.length &&
                <li>
                  {i18n(ns + 'offline_nodes', {count: offlineNodes.length})}
                </li>
              }
            </ul>,
          <ClusterActionButton
            {...actionButtonProps}
            key='action-button'
            className='btn-deploy-nodes'
            dialog={DeployNodesDialog}
            canSelectNodes
            nodeStatusesToFilter={['provisioned', 'stopped', 'error']}
          />
        ];
        break;
      case 'spawn_vms':
        actionControls = [
          <ul key='node-changes'>
            <li>
              {i18n(
                actionNs + 'nodes_to_provision',
                {
                  count: nodes.length,
                  role: cluster.get('roles').find({name: 'virt'}).get('label')
                }
              )}
            </li>
            {!!offlineNodes.length &&
              <li>
                {i18n(ns + 'offline_nodes', {count: offlineNodes.length})}
              </li>
            }
          </ul>,
          <ClusterActionButton
            {...actionButtonProps}
            key='action-button'
            className='btn-provision-vms'
            dialog={ProvisionVMsDialog}
            nodeStatusesToFilter={['pending_addition', 'error']}
          />
        ];
        break;
      default:
        actionControls = null;
    }
    return (
      <div className='dashboard-block actions-panel row'>
        <div className='col-xs-8' key={action}>
          <div className='row'>
            <div className='col-xs-12 action-description'>
              {utils.renderMultilineText(i18n(
                actionNs + (nodes.length ? 'description' : 'no_nodes'),
                {
                  defaultValue: '',
                  os: cluster.get('release').get('operating_system')
                }
              ))}
            </div>
          </div>
          <div className='row'>
            <div className='col-xs-4 changes-list'>
              {actionControls}
            </div>
            <div className='col-xs-8 task-alerts'>
              {_.map(['blocker', 'error', 'warning'],
                (severity) => <WarningsBlock
                  key={severity}
                  severity={severity}
                  blockersDescription={blockerDescriptions[action]}
                  alerts={alerts[severity]}
                />
              )}
            </div>
          </div>
        </div>
        <div className='col-xs-4 action-dropdown'>
          {this.renderActionsDropdown()}
        </div>
      </div>
    );
  },
  renderActionsDropdown() {
    var actions = _.without(this.props.actions, this.state.currentAction);
    if (!this.isActionAvailable('spawn_vms')) actions = _.without(actions, 'spawn_vms');

    return (
      <div className='dropdown'>
        <span className='deployment-modes-label'>
          {i18n(ns + 'deployment_mode')}:
        </span>
        <button className='btn btn-link dropdown-toggle' data-toggle='dropdown'>
          {i18n(
            ns + 'actions.' + this.state.currentAction + '.title'
          )} <span className='caret'></span>
        </button>
        <ul className='dropdown-menu'>
          {_.map(actions,
            (action) => <li key={action} className={action}>
              <button
                className='btn btn-link'
                onClick={() => this.toggleAction(action)}
              >
                {i18n(ns + 'actions.' + action + '.title')}
              </button>
            </li>
          )}
        </ul>
      </div>
    );
  },
  render() {
    var {cluster} = this.props;
    var nodes = cluster.get('nodes');
    if (nodes.length && !cluster.hasChanges() && !cluster.needsRedeployment()) return null;

    if (!nodes.length) {
      return (
        <div className='row'>
          <div className='dashboard-block clearfix'>
            <div className='col-xs-12'>
              <h4>{i18n(ns + 'new_environment_welcome')}</h4>
              <InstructionElement
                description='no_nodes_instruction'
                link={{
                  url: 'user-guide.html#add-nodes-ug',
                  title: 'user_guide'
                }}
                explanation='for_more_information_roles'
              />
              <AddNodesButton cluster={cluster} />
            </div>
          </div>
        </div>
      );
    }
    return <div>{this.renderActions()}</div>;
  }
});

var ClusterActionButton = React.createClass({
  getInitialState() {
    return {
      // offline nodes should not be selected for the task
      selectedNodeIds: _.pluck(this.props.nodes.where({online: true}), 'id')
    };
  },
  getDefaultProps() {
    return {
      disabled: false,
      alerts: {},
      canSelectNodes: false
    };
  },
  showSelectNodesDialog() {
    var {nodes, cluster, nodeStatusesToFilter} = this.props;
    nodes.fetch = function(options) {
      return this.constructor.__super__.fetch.call(this,
        _.extend({data: {cluster_id: cluster.id}}, options));
    };
    nodes.parse = function() {
      return this.getByIds(nodes.pluck('id'));
    };
    SelectNodesDialog
      .show({
        nodes,
        cluster,
        selectedNodeIds: this.state.selectedNodeIds,
        roles: cluster.get('roles'),
        nodeNetworkGroups: cluster.get('nodeNetworkGroups'),
        statusesToFilter: nodeStatusesToFilter
      })
      .done((selectedNodeIds) => this.setState({selectedNodeIds}));
  },
  render() {
    var {selectedNodeIds} = this.state;
    var {cluster, nodes, className, iconClassName, warning, dialog, canSelectNodes} = this.props;
    var disabled = this.props.disabled || !selectedNodeIds.length;
    var buttonClassName = utils.classNames({'btn btn-primary': true, 'btn-warning': warning});

    if (canSelectNodes && nodes.length > 1) {
      return (
        <div className='btn-group'>
          <button
            className={utils.classNames(buttonClassName, className)}
            disabled={disabled}
            onClick={() => dialog.show({cluster, nodeIds: selectedNodeIds})}
          >
            {!!iconClassName && <i className={iconClassName} />}
            {i18n(
              this.props.ns + (
                selectedNodeIds.length === nodes.length ?
                  'button_title_all_nodes'
                :
                  'button_title_some_nodes'
              ),
              {count: nodes.length, selected: selectedNodeIds.length}
            )}
          </button>
          <button
            className={utils.classNames(buttonClassName, 'dropdown-toggle')}
            disabled={disabled}
            data-toggle='dropdown'
          >
            <span className='caret' />
          </button>
          <ul className='dropdown-menu'>
            <li>
              <button
                className='btn btn-link btn-select-nodes'
                onClick={this.showSelectNodesDialog}
              >
                {i18n(this.props.ns + 'choose_nodes')}
              </button>
            </li>
          </ul>
        </div>
      );
    }

    return (
      <button
        className={utils.classNames(buttonClassName, className)}
        disabled={disabled}
        onClick={() => dialog.show({cluster, nodeIds: selectedNodeIds})}
      >
        {!!iconClassName && <i className={iconClassName} />}
        {i18n(
          this.props.ns +
            (nodes.length ? 'button_title_all_nodes' : 'button_title_no_nodes'),
          {count: nodes.length}
        )}
      </button>
    );
  }
});

var WarningsBlock = React.createClass({
  render() {
    var {alerts, severity, blockersDescription} = this.props;
    if (_.isEmpty(alerts)) return null;
    return (
      <div className='warnings-block'>
        {severity === 'blocker' && blockersDescription}
        <ul className={'text-' + (severity === 'warning' ? 'warning' : 'danger')}>
          {_.map(alerts, (alert, index) => <li key={severity + index}>{alert}</li>)}
        </ul>
      </div>
    );
  }
});

var ClusterInfo = React.createClass({
  mixins: [renamingMixin('clustername')],
  getClusterValue(fieldName) {
    var cluster = this.props.cluster;
    var settings = cluster.get('settings');
    switch (fieldName) {
      case 'status':
        return i18n('cluster.status.' + cluster.get('status'));
      case 'openstack_release':
        return cluster.get('release').get('name');
      case 'compute':
        var libvirtSettings = settings.get('common').libvirt_type;
        var computeLabel = _.find(libvirtSettings.values, {data: libvirtSettings.value}).label;
        if (settings.get('common').use_vcenter.value) {
          return computeLabel + ' ' + i18n(ns + 'and_vcenter');
        }
        return computeLabel;
      case 'network':
        var networkingParameters = cluster.get('networkConfiguration').get('networking_parameters');
        if (cluster.get('net_provider') === 'nova_network') {
          return i18n(ns + 'nova_with') + ' ' + networkingParameters.get('net_manager');
        }
        return (i18n('common.network.neutron_' + networkingParameters.get('segmentation_type')));
      case 'storage_backends':
        return _.map(_.where(settings.get('storage'), {value: true}), 'label') ||
          i18n(ns + 'no_storage_enabled');
      default:
        return cluster.get(fieldName);
    }
  },
  renderClusterInfoFields() {
    return (
      _.map(['status', 'openstack_release', 'compute', 'network', 'storage_backends'], (field) => {
        var value = this.getClusterValue(field);
        return (
          <div key={field}>
            <div className='col-xs-6'>
              <div className='cluster-info-title'>
                {i18n(ns + 'cluster_info_fields.' + field)}
              </div>
            </div>
            <div className='col-xs-6'>
              <div className={utils.classNames({
                'cluster-info-value': true,
                [field]: true,
                'text-danger': field === 'status' && value === i18n('cluster.status.error')
              })}>
                {_.isArray(value) ? value.map((line) => <p key={line}>{line}</p>) : <p>{value}</p>}
              </div>
            </div>
          </div>
        );
      }, this)
    );
  },
  renderClusterCapacity() {
    var capacityNs = ns + 'cluster_info_fields.';
    var capacity = this.props.cluster.getCapacity();

    return (
      <div className='row capacity-block content-elements'>
        <div className='title'>{i18n(capacityNs + 'capacity')}</div>
        <div className='col-xs-12 capacity-items'>
          <div className='col-xs-4 cpu'>
            <span>{i18n(capacityNs + 'cpu_cores')}</span>
            <span className='capacity-value'>{capacity.cores} ({capacity.ht_cores})</span>
          </div>
          <div className='col-xs-4 ram'>
            <span>{i18n(capacityNs + 'ram')}</span>
            <span className='capacity-value'>{utils.showSize(capacity.ram)}</span>
          </div>
          <div className='col-xs-4 hdd'>
            <span>{i18n(capacityNs + 'hdd')}</span>
            <span className='capacity-value'>{utils.showSize(capacity.hdd)}</span>
          </div>
        </div>
      </div>
    );
  },
  getNumberOfNodesWithRole(field) {
    var nodes = this.props.cluster.get('nodes');
    if (field === 'total') return nodes.length;
    return _.filter(nodes.invoke('hasRole', field)).length;
  },
  getNumberOfNodesWithStatus(field) {
    var nodes = this.props.cluster.get('nodes');
    switch (field) {
      case 'offline':
        return nodes.where({online: false}).length;
      case 'pending_addition':
      case 'pending_deletion':
        return nodes.where({[field]: true}).length;
      default:
        return nodes.where({status: field}).length;
    }
  },
  renderLegend(fieldsData, isRole) {
    var result = _.map(fieldsData, (field) => {
      var numberOfNodes = isRole ? this.getNumberOfNodesWithRole(field) :
        this.getNumberOfNodesWithStatus(field);
      return numberOfNodes ?
        <div key={field} className='row'>
          <div className='col-xs-10'>
            <div className='cluster-info-title'>
              {isRole && field !== 'total' ?
                this.props.cluster.get('roles').find({name: field}).get('label')
              :
                field === 'total' ?
                  i18n(ns + 'cluster_info_fields.total')
                :
                  i18n('cluster_page.nodes_tab.node.status.' + field,
                    {os: this.props.cluster.get('release').get('operating_system') || 'OS'})
              }
            </div>
          </div>
          <div className='col-xs-2'>
            <div className={'cluster-info-value ' + field}>
              {numberOfNodes}
            </div>
          </div>
        </div>
      :
        null;
    });

    return result;
  },
  renderStatistics() {
    var {cluster} = this.props;
    var roles = _.union(['total'], cluster.get('roles').pluck('name'));
    var statuses = _.without(models.Node.prototype.statuses, 'discover');
    return (
      <div className='row statistics-block'>
        <div className='title'>{i18n(ns + 'cluster_info_fields.statistics')}</div>
        {cluster.get('nodes').length ?
          [
            <div className='col-xs-6' key='roles'>
              {this.renderLegend(roles, true)}
              {!cluster.task({group: 'deployment', active: true}) &&
                <AddNodesButton cluster={cluster} />
              }
            </div>,
            <div className='col-xs-6' key='statuses'>
              {this.renderLegend(statuses)}
            </div>
          ]
        :
          <div className='col-xs-12 no-nodes-block'>
            <p>{i18n(ns + 'no_nodes_warning_add_them')}</p>
          </div>
        }
      </div>
    );
  },
  render() {
    var cluster = this.props.cluster;
    return (
      <div className='cluster-information'>
        <div className='row'>
          <div className='col-xs-6'>
            <div className='row'>
              <div className='title'>{i18n(ns + 'summary')}</div>
              <div className='col-xs-6'>
                <div className='cluster-info-title'>
                  {i18n(ns + 'cluster_info_fields.name')}
                </div>
              </div>
              <div className='col-xs-6'>
                {this.state.isRenaming ?
                  <RenameEnvironmentAction
                    cluster={cluster}
                    ref='clustername'
                    {... _.pick(this, 'startRenaming', 'endRenaming')}
                  />
                :
                  <div className='cluster-info-value name' onClick={this.startRenaming}>
                    <button className='btn-link cluster-name'>
                      {cluster.get('name')}
                    </button>
                    <i className='glyphicon glyphicon-pencil'></i>
                  </div>
                }
              </div>
              {this.renderClusterInfoFields()}
              {(cluster.get('status') === 'operational') &&
                <div className='col-xs-12 go-to-healthcheck'>
                  {i18n(ns + 'healthcheck')}
                  <a href={'#cluster/' + cluster.id + '/healthcheck'}>
                    {i18n(ns + 'healthcheck_tab')}
                  </a>
                </div>
              }
              <div className='col-xs-12 dashboard-actions-wrapper'>
                <DeleteEnvironmentAction cluster={cluster} />
                <ResetEnvironmentAction
                  cluster={cluster}
                  task={cluster.task({group: 'deployment', active: true})}
                />
              </div>
            </div>
          </div>
          <div className='col-xs-6'>
            {this.renderClusterCapacity()}
            {this.renderStatistics()}
          </div>
        </div>
      </div>
    );
  }
});

var AddNodesButton = React.createClass({
  render() {
    return (
      <a
        className='btn btn-success btn-add-nodes'
        href={'#cluster/' + this.props.cluster.id + '/nodes/add'}
      >
        <i className='glyphicon glyphicon-plus-white' />
        {i18n(ns + 'go_to_nodes')}
      </a>
    );
  }
});

var RenameEnvironmentAction = React.createClass({
  applyAction(e) {
    e.preventDefault();
    var {cluster, endRenaming} = this.props;
    var name = _.trim(this.state.name);
    if (name !== cluster.get('name')) {
      var deferred = cluster.save({name}, {patch: true, wait: true});
      if (deferred) {
        this.setState({disabled: true});
        deferred
          .fail((response) => {
            if (response.status === 409) {
              this.setState({error: utils.getResponseText(response)});
            } else {
              utils.showErrorDialog({
                title: i18n(ns + 'rename_error.title'),
                response: response
              });
            }
          })
          .done(() => {
            dispatcher.trigger('updatePageLayout');
          })
          .always(() => {
            this.setState({disabled: false});
            if (!this.state.error) endRenaming();
          });
      } else if (cluster.validationError) {
        this.setState({error: cluster.validationError.name});
      }
    } else {
      endRenaming();
    }
  },
  getInitialState() {
    return {
      name: this.props.cluster.get('name'),
      disabled: false,
      error: ''
    };
  },
  onChange(inputName, newValue) {
    this.setState({
      name: newValue,
      error: ''
    });
  },
  handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.applyAction(e);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.props.endRenaming();
    }
  },
  render() {
    var classes = {
      'rename-block': true,
      'has-error': !!this.state.error
    };
    return (
      <div className={utils.classNames(classes)}>
        <div className='action-body' onKeyDown={this.handleKeyDown}>
          <Input
            type='text'
            disabled={this.state.disabled}
            className={utils.classNames({'form-control': true, error: this.state.error})}
            maxLength='50'
            onChange={this.onChange}
            defaultValue={this.state.name}
            selectOnFocus
            autoFocus
          />
          {this.state.error &&
            <div className='text-danger'>{this.state.error}</div>
          }
        </div>
      </div>
    );
  }
});

var ResetEnvironmentAction = React.createClass({
  mixins: [
    backboneMixin('cluster'),
    backboneMixin('task')
  ],
  getDescriptionKey() {
    var {cluster, task} = this.props;
    if (task) {
      if (task.match({name: 'reset_environment'})) return 'repeated_reset_disabled';
      return 'reset_disabled_for_deploying_cluster';
    }
    if (cluster.get('nodes').all({status: 'discover'})) return 'no_changes_to_reset';
    return 'reset_environment_description';
  },
  render() {
    var {cluster, task} = this.props;
    var isLocked = cluster.get('status') === 'new' &&
      cluster.get('nodes').all({status: 'discover'}) ||
      !!task;
    return (
      <div className='pull-right reset-environment'>
        <button
          className='btn btn-default reset-environment-btn'
          onClick={() => ResetEnvironmentDialog.show({cluster})}
          disabled={isLocked}
        >
          {i18n(ns + 'reset_environment')}
        </button>
        <Tooltip
          key='reset-tooltip'
          placement='right'
          text={!isLocked ? i18n(ns + 'reset_environment_warning') :
            i18n(ns + this.getDescriptionKey())}
        >
          <i className='glyphicon glyphicon-info-sign' />
        </Tooltip>
      </div>
    );
  }
});

var DeleteEnvironmentAction = React.createClass({
  render() {
    return (
      <div className='delete-environment pull-left'>
        <button
          className='btn delete-environment-btn btn-default'
          onClick={() => RemoveClusterDialog.show({cluster: this.props.cluster})}
        >
          {i18n(ns + 'delete_environment')}
        </button>
        <Tooltip
          key='delete-tooltip'
          placement='right'
          text={i18n(ns + 'alert_delete')}
        >
          <i className='glyphicon glyphicon-info-sign' />
        </Tooltip>
      </div>
    );
  }
});

var InstructionElement = React.createClass({
  propTypes: {
    description: React.PropTypes.string.isRequired,
    isAlert: React.PropTypes.bool,
    link: React.PropTypes.shape({
      url: React.PropTypes.string,
      title: React.PropTypes.string
    }),
    explanation: React.PropTypes.string
  },
  getDefaultProps() {
    return {
      isAlert: false
    };
  },
  render() {
    var {description, isAlert, link, explanation} = this.props;
    return (
      <div className={utils.classNames({instruction: true, invalid: isAlert})}>
        {i18n(ns + description) + (link ? ' ' : '')}
        {link &&
          <a href={utils.composeDocumentationLink(link.url)} target='_blank'>
            {i18n(ns + link.title)}
          </a>
        }
        {explanation ? ' ' + i18n(ns + explanation) : '.'}
      </div>
    );
  }
});

export default DashboardTab;
