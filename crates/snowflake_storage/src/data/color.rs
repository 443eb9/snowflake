#[derive(Debug, Clone, Copy)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

impl Into<iced::Color> for Color {
    fn into(self) -> iced::Color {
        iced::Color {
            r: self.r as f32 / 255.0,
            g: self.g as f32 / 255.0,
            b: self.b as f32 / 255.0,
            a: 1.0,
        }
    }
}

impl From<iced::Color> for Color {
    fn from(color: iced::Color) -> Self {
        Color {
            r: (color.r * 255.0) as u8,
            g: (color.g * 255.0) as u8,
            b: (color.b * 255.0) as u8,
        }
    }
}

impl Color {
    pub fn into_packed(self) -> u32 {
        ((self.r as u32) << 0) | ((self.g as u32) << 8) | ((self.b as u32) << 16)
    }

    pub fn from_packed(packed: u32) -> Self {
        Color {
            r: ((packed >> 0) & 0xff) as u8,
            g: ((packed >> 8) & 0xff) as u8,
            b: ((packed >> 16) & 0xff) as u8,
        }
    }
}
