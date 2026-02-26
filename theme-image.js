/**
 * Theme Image Converter
 * 
 * Replaces static images with dynamically generated canvas visuals that match
 * the website's current theme.
 * 
 * usage: <img data-theme-src="path/to/image.png" class="theme-image" alt="...">
 */

(function() {
  // Theme Colors (matched with CSS and Python script)
  const THEME = {
    dark: {
      darkest: [5, 8, 14],    // #05080E (Deep Navy/Black - Cyber)
      lightest: [88, 166, 255] // #58A6FF (Bright Blue - Cyber)
    },
    light: {
      darkest: [42, 93, 156],  // #2A5D9C (Deep Blue - Classic)
      lightest: [230, 228, 221] // #E6E4DD (Beige - Classic)
    }
  };

  // Cache processed blobs to avoid expensive re-processing
  // Key: "src|themeMode" -> Blob URL
  const blobCache = new Map();

  function getThemeMode() {
    // In this site, dark mode is the default (no attribute), and light mode is data-theme="light"
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function hexToRgb(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
      return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : null;
  }

  function processImage(imgElement) {
    const src = imgElement.getAttribute('data-theme-src');
    if (!src) return;

    const currentTheme = getThemeMode();
    const cacheKey = `${src}|${currentTheme}`;
    
    // Get wrapper element
    const wrapper = imgElement.closest('.theme-image-wrapper');

    // Copy alt text to wrapper for CSS display if needed
    if (wrapper) {
      const altText = imgElement.getAttribute('alt') || 'Unknown Image';
      wrapper.setAttribute('data-alt', altText);
    }

    // Check cache first
    if (blobCache.has(cacheKey)) {
      imgElement.src = blobCache.get(cacheKey);
      if (wrapper) {
        wrapper.classList.remove('loading', 'error');
        wrapper.classList.add('loaded');
      }
      return;
    }
    
    // Set loading state
    if (wrapper) {
      wrapper.classList.add('loading');
      wrapper.classList.remove('loaded', 'error');
    }

    const tempImg = new Image();
    // Enable CORS for remote files (like GitHub) to prevent tainted canvas
    tempImg.crossOrigin = "anonymous";
    
    tempImg.onload = function() {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = tempImg.width;
      canvas.height = tempImg.height;

      // Draw original image
      ctx.drawImage(tempImg, 0, 0);

      try {
        // Get pixel data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        const themeColors = THEME[currentTheme];
        const darkest = themeColors.darkest;
        const lightest = themeColors.lightest;

        // Process pixels
        for (let i = 0; i < data.length; i += 4) {
          // Get RGB
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Alpha (skip fully transparent)
          if (data[i + 3] === 0) continue;

          // Calculate luminosity (standard Rec. 709)
          let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          let l_norm = lum / 255.0;

          // Swapped: Dark mode now uses inverted map for punchy Cyber-Blue look
          // Light mode uses normal map for Classic Blue/Beige look
          if (currentTheme === 'dark') {
            l_norm = 1.0 - l_norm;
          }

          // Map colors
          data[i]     = darkest[0] * (1 - l_norm) + lightest[0] * l_norm;
          data[i + 1] = darkest[1] * (1 - l_norm) + lightest[1] * l_norm;
          data[i + 2] = darkest[2] * (1 - l_norm) + lightest[2] * l_norm;
        }

        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob(function(blob) {
          const url = URL.createObjectURL(blob);
          blobCache.set(cacheKey, url);
          imgElement.src = url;
          
          // Update wrapper state
          if (wrapper) {
            wrapper.classList.remove('loading', 'error');
            wrapper.classList.add('loaded');
          }
        }, 'image/png');
        
      } catch (e) {
        // Fallback for CORS/Tainted Canvas issues (e.g. local file system)
        console.warn('ThemeImage: Canvas tainted or error, using CSS filter fallback.', e);
        
        // Apply CSS filter as fallback to match theme
        const currentTheme = getThemeMode();
        if (currentTheme === 'dark') {
          // Dark mode: invert and apply blue tint
          imgElement.style.filter = 'invert(1) hue-rotate(180deg) saturate(0.3) brightness(0.8)';
        } else {
          // Light mode: sepia and blue tint
          imgElement.style.filter = 'sepia(0.3) saturate(0.8) brightness(1.1)';
        }
        
        imgElement.src = src;
        
        // Update wrapper state
        if (wrapper) {
          wrapper.classList.remove('loading');
          wrapper.classList.add('loaded');
        }
      }
    };

    tempImg.onerror = function() {
      console.error(`Failed to load theme image: ${src}`);
      
      // Update wrapper to error state
      if (wrapper) {
        wrapper.classList.remove('loading', 'loaded');
        wrapper.classList.add('error');
      }
    };

    // Add loaded event to track actual loading
    tempImg.src = src;
    console.log('ThemeImage: Processing', src, 'for theme:', currentTheme);
  }

  function initThemeImages() {
    const images = document.querySelectorAll('img[data-theme-src]');
    console.log('ThemeImage: Found', images.length, 'images to process');
    images.forEach(img => {
      processImage(img);
    });
  }

  // Initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeImages);
  } else {
    initThemeImages();
  }

  // Observe theme changes
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === "attributes" && mutation.attributeName === "data-theme") {
        initThemeImages();
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });

  // Expose global init function
  window.refreshThemeImages = initThemeImages;

})();
