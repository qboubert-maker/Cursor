{
  "targets": [
    {
      "target_name": "blank_delay_engine",
      "sources": ["native/macro_engine.cpp", "native/vigem/srczip/ViGEmClient-master/src/ViGEmClient.cpp"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "native/vigem/srczip/ViGEmClient-master/include",
        "native/vigem/srczip/ViGEmClient-master/src"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": ["NAPI_CPP_EXCEPTIONS"],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "conditions": [
        [
          "OS=='win'",
          {
            "libraries": ["winmm.lib", "user32.lib", "xinput.lib", "hid.lib", "setupapi.lib", "avrt.lib", "cfgmgr32.lib"],
            "msvs_settings": {
              "VCCLCompilerTool": {
                "ExceptionHandling": 1,
                "AdditionalOptions": ["/std:c++17", "/EHsc"]
              }
            }
          }
        ]
      ]
    },
    {
      "target_name": "blank_keyboard_engine",
      "sources": ["native/keyboard_engine.cpp"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": ["NAPI_CPP_EXCEPTIONS"],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "conditions": [
        [
          "OS=='win'",
          {
            "libraries": ["winmm.lib", "user32.lib", "hid.lib", "setupapi.lib", "avrt.lib", "cfgmgr32.lib"],
            "msvs_settings": {
              "VCCLCompilerTool": {
                "ExceptionHandling": 1,
                "AdditionalOptions": ["/std:c++17", "/EHsc"]
              }
            }
          }
        ]
      ]
    }
  ]
}
