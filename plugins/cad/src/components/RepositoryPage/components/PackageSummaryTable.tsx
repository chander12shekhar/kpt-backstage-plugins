/**
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Table, TableColumn } from '@backstage/core-components';
import { useRouteRef } from '@backstage/core-plugin-api';
import { IconButton, makeStyles } from '@material-ui/core';
import { ClassNameMap } from '@material-ui/core/styles/withStyles';
import React, { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { packageRouteRef } from '../../../routes';
import {
  PackageRevision,
  PackageRevisionLifecycle,
} from '../../../types/PackageRevision';
import { Repository } from '../../../types/Repository';
import { getSyncStatus, SyncStatus } from '../../../utils/configSync';
import { formatCreationTimestamp } from '../../../utils/formatDate';
import { PackageSummary } from '../../../utils/packageSummary';
import { isDeploymentRepository } from '../../../utils/repository';
import { PackageIcon } from '../../Controls';
import { SyncStatusVisual } from './SyncStatusVisual';

type PackageRevisionsTableProps = {
  title: string;
  repository: Repository;
  packages: PackageSummary[];
};

type RenderColumn = (row: PackageSummaryRow) => JSX.Element;

type UnpublishedPackageRevision = {
  name: string;
  revision: string;
  packageName: string;
  lifecycle: PackageRevisionLifecycle;
  created: string;
  navigate: () => void;
};

type PackageSummaryRow = {
  id: string;
  name: string;
  revision: string;
  packageName: string;
  syncStatus?: SyncStatus | null;
  lifecycle: PackageRevisionLifecycle;
  created: string;
  navigate: () => void;
  unpublished?: UnpublishedPackageRevision;
};

type NavigateToPackageRevision = (revision: PackageRevision) => void;

const useStyles = makeStyles({
  iconButton: {
    position: 'absolute',
    transform: 'translateY(-50%)',
  },
});

const renderStatusColumn = (
  thisPackageRevisionRow: PackageSummaryRow,
  classes: ClassNameMap,
): JSX.Element => {
  const unpublishedRevision = thisPackageRevisionRow.unpublished;

  if (unpublishedRevision) {
    return (
      <IconButton
        size="small"
        className={classes.iconButton}
        onClick={e => {
          e.stopPropagation();
          unpublishedRevision.navigate();
        }}
      >
        <PackageIcon lifecycle={unpublishedRevision.lifecycle} />
      </IconButton>
    );
  }

  return <Fragment />;
};

const getTableColumns = (
  includeSyncsColumn: boolean,
  renderStatus: RenderColumn,
  renderSync: RenderColumn,
): TableColumn<PackageSummaryRow>[] => {
  const columns: TableColumn<PackageSummaryRow>[] = [
    {
      title: 'Status',
      width: '80px',
      render: renderStatus,
    },
    { title: 'Name', field: 'packageName' },
    { title: 'Revision', field: 'revision' },
    { title: 'Lifecycle', field: 'lifecycle' },
    { title: 'Created', field: 'created' },
  ];

  if (includeSyncsColumn) {
    columns.splice(columns.length - 1, 0, {
      title: 'Sync Status',
      render: renderSync,
    });
  }

  return columns;
};

const getRootSyncStatus = (
  packageSummary: PackageSummary,
): SyncStatus | null | undefined => {
  if (packageSummary.latestPublishedRevision) {
    const rootSync = packageSummary.sync;

    if (rootSync?.status) {
      return getSyncStatus(rootSync.status);
    }

    return null;
  }

  return undefined;
};

const mapToUnpublishedRevision = (
  packageSummary: PackageSummary,
  navigateToPackageRevision: NavigateToPackageRevision,
): UnpublishedPackageRevision | undefined => {
  const unpublishedRevision = packageSummary.unpublishedRevision;

  if (unpublishedRevision) {
    return {
      name: unpublishedRevision.metadata.name,
      packageName: unpublishedRevision.spec.packageName,
      revision: unpublishedRevision.spec.revision,
      lifecycle: unpublishedRevision.spec.lifecycle,
      created: formatCreationTimestamp(
        unpublishedRevision.metadata.creationTimestamp,
      ),
      navigate: () => navigateToPackageRevision(unpublishedRevision),
    };
  }

  return undefined;
};

const mapToPackageSummaryRow = (
  packageSummary: PackageSummary,
  navigateToPackageRevision: NavigateToPackageRevision,
): PackageSummaryRow => {
  const onePackage =
    packageSummary.latestPublishedRevision ?? packageSummary.latestRevision;

  return {
    id: onePackage.metadata.name,
    name: onePackage.metadata.name,
    packageName: onePackage.spec.packageName,
    revision: onePackage.spec.revision,
    lifecycle: onePackage.spec.lifecycle,
    syncStatus: getRootSyncStatus(packageSummary),
    created: formatCreationTimestamp(onePackage.metadata.creationTimestamp),
    navigate: () => navigateToPackageRevision(onePackage),
    unpublished: mapToUnpublishedRevision(
      packageSummary,
      navigateToPackageRevision,
    ),
  };
};

const mapPackageRevisionsToRows = (
  packageSummaries: PackageSummary[],
  navigateToPackageRevision: NavigateToPackageRevision,
): PackageSummaryRow[] => {
  return packageSummaries.map(summary =>
    mapToPackageSummaryRow(summary, navigateToPackageRevision),
  );
};

export const PackageRevisionsTable = ({
  title,
  repository,
  packages,
}: PackageRevisionsTableProps) => {
  const classes = useStyles();
  const navigate = useNavigate();

  const packageRef = useRouteRef(packageRouteRef);

  const navigateToPackageRevision: NavigateToPackageRevision = (
    revision: PackageRevision,
  ): void => {
    const packageName = revision.metadata.name;
    const repositoryName = revision.spec.repository;

    navigate(packageRef({ repositoryName, packageName }));
  };

  const renderStatus = (row: PackageSummaryRow): JSX.Element =>
    renderStatusColumn(row, classes);
  const renderSync = (row: PackageSummaryRow): JSX.Element => (
    <SyncStatusVisual syncStatus={row.syncStatus} />
  );

  const includeSyncsColumn = isDeploymentRepository(repository);
  const columns = getTableColumns(includeSyncsColumn, renderStatus, renderSync);

  const data = mapPackageRevisionsToRows(packages, navigateToPackageRevision);

  return (
    <Table
      title={title}
      options={{ search: false, paging: false }}
      columns={columns}
      data={data}
      onRowClick={(_, thisPackage) => thisPackage?.navigate()}
    />
  );
};