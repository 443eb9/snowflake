use std::ops::Deref;

use chrono::{DateTime, Utc};

use crate::data::{Color, Id, Identifiable};

#[derive(Debug, Clone)]
pub struct Tag {
    pub id: Id<Tag>,
    pub name: String,
    pub color: Color,
    pub created_at: DateTime<Utc>,
}

impl Identifiable for Tag {}
