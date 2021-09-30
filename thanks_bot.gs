function doPost(e) {
  try {
    setProperties();
    const prop = PropertiesService.getScriptProperties();
    const params = JSON.parse(e.postData.getDataAsString());

    // RequestURL登録時の疎通確認用
    if (params.type == "url_verification") {
      return ContentService.createTextOutput(params.challenge);
    }

    if (prop.getProperty("verificationToken") != params.token) {
      throw new Error("invalid token.");
    }

    const channelId = params.event.channel;
    const eventType = params.event.type;
    const timeStamp = params.event.ts;

    // 特定のメッセージだけチェックする
    if(availableEvent(eventType, channelId, timeStamp)) {
      const text = params.event.text;
      const triggerWord = "++";

      if (text != undefined && text.includes(triggerWord)) {
        // <@(ユーザID)++> という形でメッセージが来る
        const thanks_message = text.match(/^<\@(.*)>\+\+|^<\@(.*)>\s\+\+/);
        if (thanks_message) {
          const userId = thanks_message[1] || thanks_message[2];
          const user = getUser(userId);
          if (user != undefined) {
            const name = user.profile.display_name || user.name;
            // シートにいいね数記録+合計を取得
            const count = updateCount(user.id, name);
            let text = createMessage(name, count);
            postMessage(channelId, text);
          }
        }
      }
    }
  }
  catch(error) {
    logger(error);
  }

}

function updateCount(userId, name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('list');
  const textFinder = sheet.createTextFinder(userId);
  const cell = textFinder.findNext();
  let count = 1;
  if (cell) {
    const row = cell.getLastRow();
    count = sheet.getRange(row, 3).getValue() + 1;
    sheet.getRange(row, 3).setValue(count);
  } else {
    const row = sheet.getLastRow() + 1;
    sheet.getRange(row, 1).setValue(userId);
    sheet.getRange(row, 2).setValue(name);
    sheet.getRange(row, 3).setValue(count);
  }
  return count;
}

function duplicateCheck(channelId, timeStamp) {
  const cache = CacheService.getScriptCache();
  const cacheKey = channelId + ':' + timeStamp;
  const cached = cache.get(cacheKey);
  if (cached != null) {
    return false;
  } else {
    cache.put(cacheKey, true, 400);
    return true;
  }
}

function availableEvent(eventType, channelId, timeStamp) {
  // const prop = PropertiesService.getScriptProperties();
  // prop.getProperty("notificationChannelId") == channelId
  return eventType == "message" && duplicateCheck(channelId, timeStamp)
}

function getUser(userId) {
  const prop = PropertiesService.getScriptProperties();
  const token = prop.getProperty("botToken");
  const options = {
    "method" : "get",
    "contentType": "application/x-www-form-urlencoded",
    "payload" : {
      "token": token,
      "user": userId
    }
  };
  const url = "https://slack.com/api/users.info";
  const response = UrlFetchApp.fetch(url, options);
  const user = JSON.parse(response).user;

  return user;
}

function getUsers() {
  const prop = PropertiesService.getScriptProperties();
  const token = prop.getProperty("botToken");
  const options = {
    "method" : "get",
    "contentType": "application/x-www-form-urlencoded",
    "payload" : {
      "token": token
    }
  };
  const url = "https://slack.com/api/users.list";
  const response = UrlFetchApp.fetch(url, options);
  const users = JSON.parse(response).members;

  users.forEach(function(user){
    console.log(user.id + " : " + user.name + " : " + user.profile.display_name);
    const name = user.profile.display_name || user.name;
    console.log(name);
  });

  return users;
}

function createMessage(name = "test", count = 10) {
  if (count == 1) {
    text = ":tada::birthday::tada: " + name + "さん初いいねおめでとう〜！ :tada::birthday::tada:";
  } else if ((count % 10) == 0) {
    text = ":tada: " + name + "さんの" + count.toString() + "回目のいいねおめでとう〜！" + randomExcellentWord();
  } else {
    text = ":+1: " + name + "さんは今まで" + count.toString() + "回いいねをもらったよ〜！" + randomGoodWord() + " :+1:";
  }

  if (/8/.test(count)) {
    text = ":+1::den8:" + text + ":den8::+1:"
  }

  return text;
}

function test() {
  console.log(randomExcellentWord());
}

function randomExcellentWord() {
  const excellentWords = [
    { item: ":crossed_flags:日本一すごい！:crossed_flags:", weight: 15 },
    { item: ":earth_asia:世界一すごい！:earth_asia:", weight: 15 },
    { item: ":takarabune::takara: プロジェクトの宝…！:takara: :takarabune:", weight: 13 },
    { item: ":eyes::fire:圧倒的存在感…！:fire::eyes:", weight: 13 },
    { item: ":muscle::muscle:頼もしさの化身:muscle::muscle:", weight: 13 },
    { item: ":sasuga:控えめに言って最高:tensai:", weight: 8 },
    { item: ":tada::partying_face::tada:優勝:tada::partying_face::tada:", weight: 8 },
    { item: ":sparkles::kirakira2: :sparkles:ファビュラス:sparkles::kirakira2: :sparkles:", weight: 8 },
    { item: ":pray::toutoi::pray: 尊い〜〜！:pray::toutoi::pray:", weight: 2 },
    { item: ":pray::sugoisob::pray: 人知を超えた尊さ:pray: :sugoisob: :pray:", weight: 2 },
    { item: ":angel::niji1: :angel:天使だ…！:angel::niji2::angel:", weight: 1.1 },
    { item: ":pray-man::pray-woman2: :kirakira1: :internet-god::kirakira1:  神…！！:kirakira1: :internet-god::kirakira1:  :pray-man2: :pray-woman1:", weight: 1.1 },
    { item: ":fire: :shuzo2: :fire: <今日からお前は富士山だ！！！:mount_fuji: :ie_explosion: :mount_fuji:", weight: 0.8 }
  ];

  const rand = Math.random() * 100;
  let s = 0.0;
  for (const excellentWord of excellentWords) {
    s += excellentWord.weight
    if (rand < s) {
       return excellentWord.item
    }
  }
}

function randomGoodWord() {
  const goodWordList = [
    { item: "いいね！", weight: 15 },
    { item: "グッジョブ！", weight: 15 },
    { item: "すごい！", weight: 13 },
    { item: "えらい！", weight: 13 },
    { item: "さすが！", weight: 13 },
    { item: "いけてるね！", weight: 8 },
    { item: "すばらしい！", weight: 8 },
    { item: "たのもしい！", weight: 8 },
    { item: "天才だ！", weight: 2 },
    { item: "ワンダフル！", weight: 2 },
    { item: "最高〜！", weight: 1.1 },
    { item: "輝いてる〜！", weight: 1.1 },
    { item: "そこにしびれる！あこがれる！", weight: 0.8 }
  ];

  const rand = Math.random() * 100;
  let s = 0.0;
  for (const goodword of goodWordList) {
    s += goodword.weight
    if (rand < s) {
       return goodword.item
    }
  }
}

function postMessage(channelId, message) {
  const prop = PropertiesService.getScriptProperties();
  const token = prop.getProperty("botToken");
  const url = "https://slack.com/api/chat.postMessage";

  var payload = {
    "token" : token,
    "channel" : channelId,
    "text" : message
  };

  var params = {
    "method" : "post",
    "payload" : payload
  };

  // Slackに投稿する
  UrlFetchApp.fetch(url, params);
}

function logger(error){
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('log');
  const row = sheet.getLastRow() + 1;
  errorLog =  "[名前] " + error.name + "\n" +
              "[場所] " + error.fileName + "(" + error.lineNumber + "行目)\n" +
              "[メッセージ]" + error.message + "\n" +
              "[StackTrace]\n" + error.stack;

  sheet.getRange(row, 1).setValue(errorLog);
}

// 必要なtokenなどをセットする
function setProperties() {
  PropertiesService.getScriptProperties().setProperty("botToken", "xoxb-xxxxx");
  PropertiesService.getScriptProperties().setProperty("verificationToken", "xxxxx");
  PropertiesService.getScriptProperties().setProperty("notificationChannelId", "xxxxx");
  PropertiesService.getScriptProperties().setProperty("webhookUrl", "https://hooks.slack.com/services/xxxxx");
}
