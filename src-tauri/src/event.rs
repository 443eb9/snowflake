use serde::Serialize;

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadEvent {
    pub id: u32,
    pub downloaded: f32,
    pub total: Option<f32>,
    pub status: DownloadStatus,
}

#[derive(Serialize, Debug, Clone)]
pub enum DownloadStatus {
    SendingGet,
    Started,
    Aborted,
    Ongoing,
    Finished,
    Error(String),
}
