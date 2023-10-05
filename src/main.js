const { invoke, convertFileSrc } = window.__TAURI__.tauri;

function colorSchemeSwitch() {
  let colorScheme = "dark";
  let textColor = "#FFFFFF";
  document
    .getElementById("colorScheme")
    .addEventListener("click", () => {
    let ball = document.getElementById("ball");
    if (colorScheme === "dark") {
      ball.style.transform = "translateX(53px)";
        ball.style["background-color"] = "white";
      colorScheme = "light";
      textColor = "#1E1E1E";
    } else {
      ball.style.transform = "translateX(0px)";
      ball.style["background-color"] = "#1E1E1E";
      colorScheme = "dark";
      textColor = "#FFFFFF";
    }
    document.querySelector("html").style.cssText = `
      color-scheme: ${colorScheme};
      color: ${textColor};
    `;
  });
}


function extractFilename(parentPath) {
  const arr = parentPath.split('/');
  return arr[arr.length - 1];
}

function addChild(parent, childId) {
  try {
    if (!document.getElementById(childId)) {
      // create a new div and set its' properties
      let div = document.createElement("div");
      div.setAttribute("id", childId);

      parent.append(div);
    }
  } catch(err) {
    console.error(err);
  }
}

// adds a header to the parent element
function addHeader(parent, headerPath, headerText) {
  let div = document.createElement("div");

  let header = document.createElement("h1");
  header.textContent = headerText;
  header.path = headerPath;

  parent.append(header);
}

// show the header or not, based on whether or not images from the folder matched search results
function setHeaderDisplay(headerPath, displayOn) {
  let display = displayOn? "flex": "none";
  document.querySelectorAll("h1").forEach((h1) => {
    if (h1.path === headerPath) {
      h1.style.display = display;
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // target directory that has the images
  const PATH = await invoke("get_picture_dir_path", {});
  
  const images = document.getElementById("images");

  colorSchemeSwitch();
  
  // options contains the file's path, ext, and file_name
  function appendDiv(parent, options) {
    // create a new div
    let div = document.createElement("div");
    div.tabIndex = 0;
    div.fileMetadata = options;

    // create a new image and append it
    let img = document.createElement("img");
    img.setAttribute("src", options.assetUrl);
    div.append(img);
    
    // create a new span and append it
    let span = document.createElement("span");
    span.textContent = `${options.file_name}`;
    div.append(span);
    
    // append the div to the parent
    parent.append(div);
  }

  // if the focused element is an image container and enter's pressed, copy the image to the clipboard
  async function listenForEnter() {
    document
    .addEventListener("keydown", async (ev) => {
      if (ev.key === "Enter") {
        let focusedElement = document.activeElement;
        console.log(focusedElement.fileMetadata);
        if (focusedElement.fileMetadata) {
          await invoke("copy_image_to_clipboard", { imgPath: focusedElement.fileMetadata.path});
          document.getElementById("searchBox").focus();
        }
      }
    });
  }
  
  async function getPaths(path) {
    await invoke("image_search", { path })
    .then((filesMetadata) => {
      // let tabIndex = 1;
      let allPaths = [];
        for (let fileMetadata of filesMetadata) {
          // add parentPath to each object
          fileMetadata = {
            ...fileMetadata,
            get parentPath() {
              return this.path.slice(0, this.path.lastIndexOf('/', this.path.length - this.ext.length));
            },
            get assetUrl() {
              return convertFileSrc(this.path);
            }
          }
          
          // if the parent hasn't been added to #images, then add it
          // then create a corresponding header and append it to #images too
          if (!allPaths.includes(fileMetadata.parentPath)) {
            allPaths.push(fileMetadata.parentPath);
            addHeader(images, fileMetadata.parentPath, extractFilename(fileMetadata.parentPath));
            addChild(images, fileMetadata.parentPath);
          }

          // append the current file to the parent container
          let parent = document.getElementById(fileMetadata.parentPath);
          appendDiv(parent, fileMetadata);
          
        }
      })
      // focus the search box
      document.getElementById("searchBox").focus();
    }
    
    await getPaths(PATH);
    await listenForEnter();
  
  document
  .getElementById("searchBox")
  .addEventListener("input", (ev) => {
    function setDisplay(imageContainer) {
      // check if the span exists
      if (imageContainer.lastChild) {
        // match with the input in the searchBox, then display/hide the element
        if (!imageContainer.lastChild.textContent.toLowerCase().includes(ev.target.value.toLowerCase())) {
          imageContainer.style.display = "none";
          return false;
        }
        imageContainer.style.display = "flex";
        return true;
      }
      return false;
    }
    
    images.childNodes.forEach((container) => {
      if (!container.id) return;
      let containerHasMatchingImage = false;
      container.childNodes.forEach((imageContainer) => {
        if (setDisplay(imageContainer)) containerHasMatchingImage = true;
      })
      setHeaderDisplay(container.id, containerHasMatchingImage);
    });
  });

});