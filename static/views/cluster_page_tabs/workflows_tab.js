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
import models from 'models';
import {backboneMixin} from 'component_mixins';
import {UploadGraphDialog, DeleteGraphDialog} from 'views/dialogs';

var WorkflowsTab;

WorkflowsTab = React.createClass({
  mixins: [
    backboneMixin({
      modelOrCollection: (props) => props.cluster.get('deploymentGraphs'),
      renderOn: 'update'
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
      var plugins = new models.Plugins();
      return deploymentGraphs.fetch({cache: true})
        .then(() => {
          if (deploymentGraphs.some((graph) => graph.getLevel() === 'plugin')) {
            return plugins.fetch();
          }
          return Promise.resolve();
        })
        .then(() => ({plugins}));
    }
  },
  downloadMergedGraph() {},
  downloadSingleGraph() {},
  render() {
    var {cluster, plugins} = this.props;
    var ns = 'cluster_page.workflows_tab.';
    var graphTypes = _.uniq(cluster.get('deploymentGraphs').invokeMap('getType'));
    return (
      <div className='row deployment-graphs'>
        <div className='title col-xs-6'>
          {i18n(ns + 'title')}
        </div>
        <div className='title col-xs-6'>
          <button
            className='btn btn-success btn-upload-graph'
            onClick={() => UploadGraphDialog.show({cluster})
              .then(() => {
                cluster.get('deploymentGraphs').fetch();
              })}
          >
            <i className='glyphicon glyphicon-plus-white'></i>
            &nbsp;
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
              {_.map(graphTypes, (graphType) => {
                var graphs = cluster.get('deploymentGraphs').filter(
                  (graph) => graph.getType() === graphType
                );
                return [
                  <tr key='subheader' className='subheader'>
                    <td colSpan='3'>
                      {graphType}
                    </td>
                    <td>
                      <button
                        className='btn btn-link btn-download-merged-graph'
                        onClick={() => this.downloadMergedGraph(graphType)}
                      >
                        {i18n(ns + 'download_graph')}
                      </button>
                    </td>
                  </tr>
                ].concat(
                  _.map(graphs, (graph) => {
                    var level = graph.getLevel();
                    return <tr key={graph.id}>
                      <td>{graph.get('name') || '-'}</td>
                      <td className='level'>
                        {level}
                        &nbsp;
                        {level === 'plugin' &&
                          <span>
                            ({plugins.get(graph.get('relations')[0].model_id).get('title')})
                          </span>
                        }
                      </td>
                      <td>
                        {level === 'cluster' &&
                          <button
                            className='btn btn-link  btn-remove-graph'
                            onClick={() => DeleteGraphDialog.show({graph})}
                          >
                            {i18n(ns + 'delete_graph')}
                          </button>
                        }
                      </td>
                      <td>
                        <button
                          className='btn btn-link  btn-download-graph'
                          onClick={() => this.downloadSingleGraph(graph.id)}
                        >
                          {i18n(ns + 'download_graph')}
                        </button>
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
