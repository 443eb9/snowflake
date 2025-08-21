use std::{fmt::Debug, hash::Hash, marker::PhantomData};

use sqlx::{ColumnIndex, FromRow, Row};

pub trait Identifiable {}

pub struct Id<T: Identifiable> {
    value: u32,
    _marker: PhantomData<T>,
}

impl<T: Identifiable> Id<T> {
    pub fn new(value: u32) -> Self {
        Id {
            value,
            _marker: PhantomData,
        }
    }

    pub fn id(self) -> u32 {
        self.value
    }
}

impl<T: Identifiable> Debug for Id<T> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.value.fmt(f)
    }
}

impl<T: Identifiable> Clone for Id<T> {
    fn clone(&self) -> Self {
        Self {
            value: self.value.clone(),
            _marker: PhantomData,
        }
    }
}

impl<T: Identifiable> Copy for Id<T> {}

impl<T: Identifiable> PartialEq for Id<T> {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl<T: Identifiable> Eq for Id<T> {}

impl<T: Identifiable> Hash for Id<T> {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.value.hash(state);
    }
}

impl<'r, T: Identifiable, R: Row> FromRow<'r, R> for Id<T>
where
    u32: sqlx::Type<<R as sqlx::Row>::Database>,
    u32: sqlx::Decode<'r, <R as sqlx::Row>::Database>,
    &'static str: ColumnIndex<R>,
{
    fn from_row(row: &'r R) -> Result<Self, sqlx::Error> {
        Ok(Self {
            value: row.try_get("id")?,
            _marker: PhantomData,
        })
    }
}
