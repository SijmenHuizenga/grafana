package datasources

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/models"
)

func ProvideCacheService(cacheService *localcache.CacheService, bus bus.Bus) *CacheServiceImpl {
	return &CacheServiceImpl{
		CacheService: cacheService,
		Bus:          bus,
	}
}

type CacheService interface {
	GetDatasource(datasourceID int64, user *models.SignedInUser, skipCache bool) (*models.DataSource, error)
	GetDatasourceByUID(datasourceUID string, user *models.SignedInUser, skipCache bool) (*models.DataSource, error)
}

type CacheServiceImpl struct {
	CacheService *localcache.CacheService
	Bus          bus.Bus
}

func (dc *CacheServiceImpl) GetDatasource(
	datasourceID int64,
	user *models.SignedInUser,
	skipCache bool,
) (*models.DataSource, error) {
	cacheKey := idKey(datasourceID)

	if !skipCache {
		if cached, found := dc.CacheService.Get(cacheKey); found {
			ds := cached.(*models.DataSource)
			if ds.OrgId == user.OrgId {
				return ds, nil
			}
		}
	}

	plog.Debug("Querying for data source via SQL store", "id", datasourceID, "orgId", user.OrgId)

	query := &models.GetDataSourceQuery{Id: datasourceID, OrgId: user.OrgId}
	err := dc.Bus.Dispatch(query)
	if err != nil {
		return nil, err
	}

	ds := query.Result

	if ds.Uid != "" {
		dc.CacheService.Set(uidKey(ds.OrgId, ds.Uid), ds, time.Second*5)
	}
	dc.CacheService.Set(cacheKey, ds, time.Second*5)
	return ds, nil
}

func (dc *CacheServiceImpl) GetDatasourceByUID(
	datasourceUID string,
	user *models.SignedInUser,
	skipCache bool,
) (*models.DataSource, error) {
	if datasourceUID == "" {
		return nil, fmt.Errorf("can not get data source by uid, uid is empty")
	}
	if user.OrgId == 0 {
		return nil, fmt.Errorf("can not get data source by uid, orgId is missing")
	}
	uidCacheKey := uidKey(user.OrgId, datasourceUID)

	if !skipCache {
		if cached, found := dc.CacheService.Get(uidCacheKey); found {
			ds := cached.(*models.DataSource)
			if ds.OrgId == user.OrgId {
				return ds, nil
			}
		}
	}

	plog.Debug("Querying for data source via SQL store", "uid", datasourceUID, "orgId", user.OrgId)
	query := &models.GetDataSourceQuery{Uid: datasourceUID, OrgId: user.OrgId}
	err := dc.Bus.Dispatch(query)
	if err != nil {
		return nil, err
	}

	ds := query.Result

	dc.CacheService.Set(uidCacheKey, ds, time.Second*5)
	dc.CacheService.Set(idKey(ds.Id), ds, time.Second*5)
	return ds, nil
}

func idKey(id int64) string {
	return fmt.Sprintf("ds-%d", id)
}

func uidKey(orgID int64, uid string) string {
	return fmt.Sprintf("ds-orgid-uid-%d-%s", orgID, uid)
}
