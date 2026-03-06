{
  "targets": [
    {
      "target_name": "ndi_sender",
      "sources": ["ndi_sender.cpp"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "<!@(node find-ndi.js Include)"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='win'", {
          "defines": ["_WIN32"],
          "libraries": [
            "<!@(node find-ndi.js Lib/x64/Processing.NDI.Lib.x64.lib)"
          ],
          "copies": [
            {
              "destination": "<(PRODUCT_DIR)",
              "files": [
                "<!@(node find-ndi.js Bin/x64/Processing.NDI.Lib.x64.dll)"
              ]
            }
          ]
        }],
        ["OS=='mac'", {
          "libraries": [
            "<!@(node find-ndi.js lib/macOS/libndi.dylib)"
          ],
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES"
          }
        }],
        ["OS=='linux'", {
          "libraries": [
            "<!@(node find-ndi.js lib/x86_64-linux-gnu/libndi.so.6)"
          ]
        }]
      ]
    }
  ]
}
