const fs = require('fs-extra');
const path = require('path');

module.exports = {
  defaultConfig: {
    enabled: false,
    logUnknownScrolls: false
  },
  defaultConfigDetails: {
    logUnknownScrolls: { label: 'Log Unknown Scroll summons' },
  },
  pluginName: 'Summoning Tracker',
  pluginDescription: 'Creates a local csv file and saves data of summons in there.',
  init(proxy, config) {
    
    proxy.on('apiCommand', (req, resp) => {
      if (config.Config.Plugins[this.pluginName].enabled) {
        const { command: reqCommand } = req;
        const { command: respCommand, ret_code: ret_code } = resp;
        if (reqCommand === 'SummonUnit' && respCommand === 'SummonUnit' && ret_code === 0) {
          this.log(proxy, resp);
        }
        else if (reqCommand === 'summonNormalScroll' && respCommand === 'summonNormalScroll' && ret_code === 0) {
          this.log(proxy, resp, is100UnknownScroll = true);
        }
      }
    });
  },
  log(proxy, resp, is100UnknownScroll = false) {
    
    // Extract correct infos and format into a string that will be appended to the log file
    const scrollLookup = ['', 'Unknown Scroll', 'Mystical Scroll', 'Scroll of Light and Dark', 'Water Scroll', 'Fire Scroll', 'Wind Scroll', 'Legendary Scroll', 'Summoning Stone', 'Legendary Summoning Piece', 'Light & Dark Summoning Piece', 'Transcendence Scroll', 'Legendary Water Scroll', 'Legendary Fire Scroll', 'Legendary Wind Scroll', '','','', 'SWC 2018 (Asia-Pacific)', 'SWC 2018 (America)', 'SWC 2018 (Europe)', '', 'SWC 2019 Scroll (Asia-Pacific)', 'SWC 2019 Scroll (America)', 'SWC 2019 Scroll (EU)', 'Street Fighter V Scroll', 'Legendary Mercenary Scroll', 'SWC Special Scroll', 'Ancient Transcendence Scroll', '7th Anniversary Scroll', 'Legendary All-Attribute Scroll', 'Transcendence Summoning Scroll', 'SWC 2021 Scroll', '8th Anniversary Transcendence Summoning Scroll', 'Engraved Summoning Pieces', 'Cookie Run Kingdom Summon Scroll', 'Dessert Kingdom Summon Scroll', 'SWC 2022 Scroll', "Assassin's Creed Summon Scroll", 'Engraved Scroll', '9th Anniversary Transcendence Summoning Scroll', '9th Anniversary Legend Summoning Scroll', '9th Anniversary Summoning Scroll', '','','','','','','', '10th Anniversary Scroll', '',''];
    let scrollType = scrollLookup[resp.item_list[0].item_master_id];
    if (scrollType === 'Unknown Scroll' && !config.Config.Plugins[this.pluginName].logUnknownScrolls) return;
    if (scrollType === '' || scrollType === undefined) scrollType = `<UNKNOWN_ID: ${resp.item_list[0].item_master_id}>`;
    let scrollNumber = is100UnknownScroll ? 100 : resp.unit_list.length;
    proxy.log({ type: 'info', source: 'plugin', name: this.pluginName, message: `Detected ${scrollNumber} ${scrollType} summons` });

    const csv_header = 'Timestamp,Scroll Type,Stars,Element,Monster Name';
    let appendString = '';
    let respDate = new Date((resp.tvalue + resp.tzoffset) * 1000).toISOString().slice(0,-5);

    if (!is100UnknownScroll) {
      // Normal summons have one entry per unit summoned, even if there are duplicates
      for (let i = 0; i < scrollNumber; i++) {
        appendString += '\n';
        appendString += respDate + ',';
        appendString += scrollType + ',';
        appendString += resp.unit_list[i].class + ',';
        appendString += gMapping.monster.attributes[resp.unit_list[i].attribute] + ',';
        appendString += gMapping.getMonsterName(resp.unit_list[i].unit_master_id);
      }
    }
    else {
      // 100 Unknown Scroll summon has a different response format and we need to account for quantities
      objectKeys = Object.keys(resp.unit_list);
      for (let i = 0; i < objectKeys.length; i++) {
        localAppendString = '\n';
        localAppendString += respDate + ',';
        localAppendString += scrollType + ',';
        localAppendString += resp.unit_list[objectKeys[i]].unit_class + ',';
        localAppendString += gMapping.monster.attributes[resp.unit_list[objectKeys[i]].attribute] + ',';
        localAppendString += gMapping.getMonsterName(resp.unit_list[objectKeys[i]].unit_master_id);
        // For every unit summoned, we create as many duplicate lines as the quantity of this summoned unit
        for (let j = 0; j < resp.unit_list[objectKeys[i]].quantity; j++) {
          appendString += localAppendString;
        }
      }
    }
    
    // Log file access / creating the log file with the csv header, if it does not exist
    const disallowedChars = /[\\\/\:\*\?\"\<\>\|]/g;
    let filePath = path.join(config.Config.App.filesPath, resp.wizard_info.wizard_name.replace(disallowedChars, '_')+'_summons.csv');
    fs.ensureFile(filePath, (err) => {
      if (!err) {
        // Prepends the csv header, if the file was just created
        if (fs.statSync(filePath).size === 0) appendString = csv_header + appendString;
        
        // Check if file is writable
        let logfile = fs.createWriteStream(filePath, {flags: 'a', autoClose: true});
        if (!logfile.writable) {
          proxy.log({ type: 'error', source: 'plugin', name: this.pluginName, message: `Could not write to file ${filePath}` });
          return;
        }
        // Actually write to the file
        logfile.write(appendString, (err) => {
          if (err) proxy.log({ type: 'error', source: 'plugin', name: this.pluginName, message: `Error while writing to file ${filePath}` });
        });
        return;
      }
      proxy.log({ type: 'error', source: 'plugin', name: this.pluginName, message: `Could not create or access file ${filePath}. Cannot log any summon data` });
    });
  },
};
