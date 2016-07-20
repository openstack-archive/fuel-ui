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
import _ from 'underscore';
import i18n from 'i18n';
import React from 'react';
import {backboneMixin} from 'component_mixins';
import {AddNewGraphDialog, DeleteGraphDialog} from 'views/dialogs';

var WorkflowsTab;

WorkflowsTab = React.createClass({
  mixins: [
    backboneMixin({
      modelOrCollection: (props) => props.cluster.get('deploymentGraphs'),
      renderOn: 'update change'
    })
  ],
  statics: {
    breadcrumbsPath() {
      return [
        [i18n('cluster_page.tabs.workflows'), null, {active: true}]
      ];
    },
    fetchData({cluster}) {
      var deploymentGraphs = cluster.get('deploymentGraphs');
      //var plugins = new models.Plugins();
      return deploymentGraphs.fetch({cache: true})
        .then(() => {
          // if (_.some(deploymentGraphs.models, (graph) =>
          //  _.find(graph.get('relations'), (relation) => relation.model === 'plugin'))) {
          //   return plugins.fetch();
          // }
          return Promise.resolve();
        });
        //.then(() => ({plugins));
    }
  },
  render() {
    var {cluster} = this.props;
    var ns = 'cluster_page.workflows_tab.';
    var deploymentGraphs = cluster.get('deploymentGraphs').groupBy(
      (graph) => graph.get('relations')[0].type
    );
    return (
      <div className='row graphs'>
        <div className='title col-xs-6'>
          {i18n(ns + 'title')}
        </div>
        <div className='title col-xs-6'>
          <button
            className='btn btn-success btn-add-graph'
            onClick={() => AddNewGraphDialog.show({cluster})}
          >
            {i18n(ns + 'upload_graph')}
          </button>
        </div>
        <div className='wrapper col-xs-12'>
          <table className='table table-bordered table-striped'>
            <thead>
              <tr>
                <th>{i18n(ns + 'graph_name_header')}</th>
                <th>{i18n(ns + 'graph_level_header')}</th>
                <th />
                <th />
              </tr>
            </thead>
            <tbody>
              {_.map(deploymentGraphs, (graphs, graphLevel) => {
                return [
                  <tr key='subheader' className='subheader'>
                    <td colSpan='3'>
                      {graphLevel}
                    </td>
                    <td>
                      <a>
                        {i18n(ns + 'download_graph')}
                      </a>
                    </td>
                  </tr>
                ].concat(
                  _.map(graphs, (graph) => {
                    var blob = new Blob([JSON.stringify(graph.get('tasks'), null, 2)],
                      {type: 'application/json'});
                    var url = URL.createObjectURL(blob);
                    var model = graph.get('relations')[0].model;
                    var type = graph.getType();
                    return <tr key={graph.id}>
                      <td>{graph.get('name') || '-'}</td>
                      <td>{i18n(ns + model + '_graph_level')}</td>
                      <td>
                        {type !== 'default' &&
                          <button
                            className='btn btn-link'
                            onClick={() => DeleteGraphDialog.show({graph})}
                          >
                            {i18n(ns + 'delete_graph')}
                          </button>
                        }
                      </td>
                      <td>
                        <a
                          href={url}
                          download='graph.json'
                          target='_blank'>
                          {i18n(ns + 'download_graph')}
                        </a>
                      </td>
                    </tr>;
                  })
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
});

export default WorkflowsTab;
