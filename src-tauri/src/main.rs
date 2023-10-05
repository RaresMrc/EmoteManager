// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::create_dir_all;
use std::path::{Path, PathBuf};
use image::ImageFormat;
use serde::ser::{Serialize, Serializer, SerializeStruct};
use std::vec::Vec;
use std::io::Error;
use image::io::Reader as ImageReader;
use arboard::{Clipboard, ImageData};
use std::borrow::Cow;
use std::sync::Mutex;
use directories::UserDirs;

fn extract_file_path(path: &PathBuf) -> String {
    let str_path = path.to_string_lossy().to_string();
    String::from(format!("{}", &str_path[..]))
}

fn extract_file_name(path: &PathBuf) -> Option<String> {
    let str_path: String = path.to_string_lossy().to_string();
    let file_name = str_path.split('/').into_iter().last()?;
    Some(String::from(&file_name[0..file_name.len() - 4]))
}

struct PathMetadata {
    path: String,
    file_name: String,
    ext: String,
}

struct ClipboardState {
    clipboard: Mutex<Clipboard>,
}

impl Serialize for PathMetadata {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("PathMetadata", 3)?;
        state.serialize_field("path", &self.path)?;
        state.serialize_field("file_name", &self.file_name)?;
        state.serialize_field("ext", &self.ext)?;
        state.end()
    }
}

#[tauri::command]
fn get_picture_dir_path() -> String {
    let picture_dir_path = UserDirs::new().unwrap();
    match picture_dir_path.picture_dir() {
        Some(path) => {
            return String::from(path.to_str().unwrap());
        },
        None => {
            println!("Couldn't get the path to the picture directory");
            return String::from("");
        }
    }
}

fn create_dir(path: &Path) -> Result<(), Error> {
    if path.is_dir() {
        return Ok(());
    }
    create_dir_all(path)?;
    Ok(())
}

#[tauri::command]
fn image_search(path: &str) -> Vec<PathMetadata> {
    fn inner(path: &Path, images: &mut Vec<PathMetadata>) -> std::io::Result<()> {
        // parse the directory's entries
        for dir_entry in path.read_dir()? {
            match dir_entry {
                Ok(dir_entry) => {
                    // get the path of the current entry
                    let entry_path = dir_entry.path();
                    // if the path is a directory, call the function recursively
                    if entry_path.is_dir() {
                        inner(entry_path.as_ref(), images);
                    // check if the file is a jpg or png
                    } else if entry_path.extension().is_some_and(|ext| ext == "jpg" || ext == "png") {
                        // get the file's metadata
                        let path = extract_file_path(&entry_path);
                        let file_name = extract_file_name(&entry_path).unwrap_or_default();
                        let ext = String::from(entry_path.extension().unwrap_or_default().to_str().unwrap_or_default());
                        // push the structure to the array
                        images.push(PathMetadata {
                            path,
                            file_name,
                            ext,
                        });
                    }
                },
                Err(err) => {
                    println!("Couldn't read the file: {}", err);
                }
            }
        }
        Ok(())
    }
    let mut images: Vec<PathMetadata> = Vec::new();
    // if there's no such directory, create it
    create_dir(path.as_ref());
    inner(path.as_ref(), &mut images);
    images
}

#[tauri::command]
fn copy_image_to_clipboard(state: tauri::State<ClipboardState>, img_path: &str) {
    fn inner(state: tauri::State<ClipboardState>, path: &Path) -> Result<(), Error> {

        // set the format of the image
        let img_format = ImageFormat::from_path(path).unwrap();
        let mut image = ImageReader::open(path)?;
        image.set_format(img_format);

        // decode the image
        let decoded_img = image.decode().unwrap();
        
        // take the dimensions
        let width = decoded_img.width();
        let height = decoded_img.height();

        // get the byte vector
        let decoded_img = decoded_img.into_bytes();
        
        let img_data = ImageData {
            width: width.try_into().unwrap(),
            height: height.try_into().unwrap(),
            bytes: Cow::from(&decoded_img[..]).into(),
        };
        // send the image to the clipboard
        match state.clipboard.lock().unwrap().set().image(img_data) {
            Ok(unused_val) => println!("Successfully copied the image to the clipboard"),
            Err(err) => println!("Couldn't copy the image to the clipboard: {}", err),
        }
        Ok(())
    }
    inner(state, img_path.as_ref());
}


fn main() {
    tauri::Builder::default()
        .manage(ClipboardState{clipboard: Mutex::new(Clipboard::new().unwrap())})
        .invoke_handler(tauri::generate_handler![image_search, copy_image_to_clipboard, get_picture_dir_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

}



