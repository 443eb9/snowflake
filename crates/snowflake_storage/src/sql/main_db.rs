use std::path::Path;

use sqlx::{query, query_as};

use crate::{
    data::{AssetMetadata, Id, Tag},
    sql::{
        Database, Result,
        models::{RawAssetMetadata, RawTag},
    },
};

#[derive(Debug, Clone)]
pub struct MainDatabase {
    db: Database,
}

impl MainDatabase {
    pub const MAIN_DATABASE_FILENAME: &str = "main_database.sqlite3";

    pub async fn connect(lib_root: impl AsRef<Path>) -> Result<Self> {
        let db = Database::new(lib_root.as_ref().join(Self::MAIN_DATABASE_FILENAME)).await?;
        Ok(Self { db })
    }

    pub async fn init_tables(&self) {
        let pool = self.db.pool();

        let _ = query(
            r#"
create table assets_meta
(
    id          integer               not null
        constraint id_pk
            primary key autoincrement,
    name        text                  not null,
    src         text,
    desc        text,
    extension   integer               not null,
    size_bytes  integer               not null,
    created_at  integer,
    imported_at integer               not null,
    is_deleted  integer default false not null
)
            "#,
        )
        .execute(&pool);

        let _ = query(
            r#"
create table tags_meta
(
    id         integer               not null
        constraint id_pk
            primary key autoincrement,
    name       text                  not null,
    created_at integer               not null,
    color      integer               not null,
    is_deleted integer default false not null
)
            "#,
        )
        .execute(&pool);

        let _ = query(
            r#"
create table asset_tags
(
    asset_id integer not null
        constraint asset_fk
            references assets_meta
            on delete cascade,
    tag_id   integer not null
        constraint tag_fk
            references tags_meta
            on delete cascade,
    constraint relation_pk
        primary key (asset_id, tag_id)
)
            "#,
        )
        .execute(&pool);
    }

    pub async fn add_asset(
        &self,
        asset: &RawAssetMetadata,
        tags: &[Id<Tag>],
    ) -> Result<Id<AssetMetadata>> {
        let pool = self.db.pool();

        let asset_id = query_as(
            r#"
insert into assets_meta (name, src, desc, extension, size_bytes, created_at, imported_at)
values (?,?,?,?,?,?,?,?)
returning id
            "#,
        )
        .bind(&asset.name)
        .bind(&asset.src)
        .bind(&asset.desc)
        .bind(&asset.extension)
        .bind(&asset.size_bytes)
        .bind(&asset.created_at)
        .bind(&asset.imported_at)
        .fetch_one(&pool)
        .await?;

        self.add_tag_relation(asset_id, tags).await?;

        Ok(asset_id)
    }

    pub async fn add_tag(&self, tag: &RawTag) -> Result<Id<Tag>> {
        let pool = self.db.pool();

        let tag_id = query_as(
            r#"
insert into tags_meta (name, created_at, color)
values (?,?,?)
returning id
            "#,
        )
        .bind(&tag.name)
        .bind(&tag.created_at)
        .bind(&tag.color)
        .fetch_one(&pool)
        .await?;

        Ok(tag_id)
    }

    pub async fn add_tag_relation(&self, asset: Id<AssetMetadata>, tags: &[Id<Tag>]) -> Result<()> {
        if tags.is_empty() {
            return Ok(());
        }

        let pool = self.db.pool();

        let sql = format!(
            r#"
insert into asset_tags (asset_id, tag_id)
values {}
            "#,
            "(?,?)".repeat(tags.len())
        );
        let mut q = query(&sql);

        for tag in tags {
            q = q.bind(asset.id()).bind(tag.id());
        }

        q.execute(&pool).await?;

        Ok(())
    }

    pub async fn get_all_assets(&self) -> Result<Vec<AssetMetadata>> {
        let pool = self.db.pool();
        Ok(query_as::<_, RawAssetMetadata>(
            r#"
select id, name, src, desc, extension, size_bytes, created_at, imported_at
from assets_meta
                    "#,
        )
        .fetch_all(&pool)
        .await?
        .into_iter()
        .map(Into::into)
        .collect())
    }

    pub async fn get_assets_with_tag(
        &self,
        tags: &[Id<Tag>],
        and_mode: bool,
    ) -> Result<Vec<AssetMetadata>> {
        let pool = self.db.pool();

        let q = if tags.is_empty() {
            query_as::<_, RawAssetMetadata>(
                r#"
select id, name, src, desc, extension, size_bytes, created_at, imported_at
from assets_meta
join (
    select asset_id
    from asset_tags
    group by asset_id
    having count(distinct tag_id) = 0
) t on assets_meta.id = t.asset_id
                "#,
            )
            .fetch_all(&pool)
            .await
        } else {
            let mut bindings = "?,".repeat(tags.len());
            bindings.pop();
            let sql = format!(
                r#"
select id, name, src, desc, extension, size_bytes, created_at, imported_at
from assets_meta
join (
    select asset_id
    from asset_tags
    where tag_id IN ({})
    group by asset_id
    {}
) t on assets_meta.id = t.asset_id
"#,
                bindings,
                if and_mode {
                    format!(
                        r#"
having count(distinct tag_id) = {}
                        "#,
                        tags.len()
                    )
                } else {
                    String::new()
                },
            );
            let mut q = query_as::<_, RawAssetMetadata>(&sql);

            for tag in tags {
                q = q.bind(tag.id());
            }

            q.fetch_all(&pool).await
        };

        Ok(q?.into_iter().map(Into::into).collect())
    }

    pub async fn get_all_tags(&self) -> Result<Vec<Tag>> {
        let pool = self.db.pool();

        Ok(query_as::<_, RawTag>(
            r#"
select id, name, created_at, color
from tags_meta
            "#,
        )
        .fetch_all(&pool)
        .await?
        .into_iter()
        .map(Into::into)
        .collect())
    }

    pub async fn get_tags(&self, tags: &[Id<Tag>]) -> Result<Vec<Tag>> {
        if tags.is_empty() {
            return Ok(Vec::new());
        }

        let pool = self.db.pool();

        let mut bindings = "?,".repeat(tags.len());
        bindings.pop();
        let sql = format!(
            r#"
select id, name, created_at, color
from tags_meta
where id IN ({})
            "#,
            bindings
        );

        let mut q = query_as::<_, RawTag>(&sql);
        for tag in tags {
            q = q.bind(tag.id());
        }

        Ok(q.fetch_all(&pool)
            .await?
            .into_iter()
            .map(Into::into)
            .collect())
    }

    pub async fn update_asset(&self, asset: &RawAssetMetadata) -> Result<()> {
        let pool = self.db.pool();

        query(
            r#"
update assets_meta
set name =?, src =?, desc =?, extension =?, size_bytes =?, created_at =?, imported_at =?
where id =?
            "#,
        )
        .bind(&asset.name)
        .bind(&asset.src)
        .bind(&asset.desc)
        .bind(&asset.extension)
        .bind(&asset.size_bytes)
        .bind(&asset.created_at)
        .bind(&asset.imported_at)
        .bind(&asset.id)
        .execute(&pool)
        .await?;

        Ok(())
    }

    pub async fn update_tag(&self, tag: &RawTag) -> Result<()> {
        let pool = self.db.pool();

        query(
            r#"
update tags_meta
set name =?, created_at =?, color =?
where id =?
            "#,
        )
        .bind(&tag.name)
        .bind(&tag.created_at)
        .bind(&tag.color)
        .bind(&tag.id)
        .execute(&pool)
        .await?;

        Ok(())
    }

    pub async fn mark_asset_deleted(
        &self,
        assets: &[Id<AssetMetadata>],
        is_deleted: bool,
    ) -> Result<()> {
        if assets.is_empty() {
            return Ok(());
        }

        let pool = self.db.pool();

        let mut bindings = "?,".repeat(assets.len());
        bindings.pop();
        let sql = format!(
            r#"
update assets_meta
set is_deleted = {}
where id IN ({})
            "#,
            if is_deleted { 1 } else { 0 },
            bindings
        );

        let mut q = query(&sql);
        for asset in assets {
            q = q.bind(asset.id());
        }

        q.execute(&pool).await?;

        Ok(())
    }

    pub async fn mark_tag_deleted(&self, tags: &[Id<Tag>], is_deleted: bool) -> Result<()> {
        if tags.is_empty() {
            return Ok(());
        }

        let pool = self.db.pool();

        let mut bindings = "?,".repeat(tags.len());
        bindings.pop();
        let sql = format!(
            r#"
update tags_meta
set is_deleted = {}
where id IN ({})
            "#,
            if is_deleted { 1 } else { 0 },
            bindings
        );
        let mut q = query(&sql);
        for tag in tags {
            q = q.bind(tag.id());
        }
        q.execute(&pool).await?;

        Ok(())
    }

    pub async fn delete_assets(&self, assets: &[Id<AssetMetadata>]) -> Result<()> {
        if assets.is_empty() {
            return Ok(());
        }

        let pool = self.db.pool();

        let mut bindings = "?,".repeat(assets.len());
        bindings.pop();
        let sql = format!(
            r#"
delete from assets_meta
where id IN ({})
            "#,
            bindings
        );

        let mut q = query(&sql);
        for asset in assets {
            q = q.bind(asset.id());
        }
        q.execute(&pool).await?;

        Ok(())
    }

    pub async fn delete_tags(&self, tags: &[Id<Tag>]) -> Result<()> {
        if tags.is_empty() {
            return Ok(());
        }

        let pool = self.db.pool();

        let mut bindings = "?,".repeat(tags.len());
        bindings.pop();
        let sql = format!(
            r#"
delete from tags_meta
where id IN ({})
            "#,
            bindings
        );

        let mut q = query(&sql);
        for tag in tags {
            q = q.bind(tag.id());
        }
        q.execute(&pool).await?;

        Ok(())
    }
}
