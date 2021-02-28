"use strict";

// Print all entries, across all of the *async* sources, in chronological order.

// this class remembers which log source the log entry has come from
class InMemoryLogEntry {
  constructor(logEntry, logSourceIndex){
    this.logEntry = logEntry;
    this.logSourceIndex = logSourceIndex;
    this.date = logEntry.date; // alows for .date to return the logEntry's date
  }
}

// helpful checking function for debug to make sure the list is in the proper order
function checkProperOrder(curList){
  if(curList.length > 1){
    for(let i = 0; i < curList.length - 1; i++){
      if(+curList[i].date > +curList[i + 1].date){
        return false 
      }
    }
  }
  return true;
}

function binarySearchIndex(curList, curIndex, curMax, logEntryDate, stepSize){
  // console.log("binarySearchIndex:", curList, curIndex, curMax, logEntryDate, stepSize);

  let curDate = curList[curIndex].date;
  let nextDate = null;

  // Asserts
  if(stepSize == null || curDate == null){
    return -1; // curDate and stepSize cannot be null, abort
  }
  //starts as half of list, then quarter, then eighth, etc
  stepSize = ~~(stepSize / 2);
  if(stepSize <= 0){
    stepSize = 1;
  }
  if(curList.length > curIndex + 1){
    nextDate = curList[curIndex+1].date;
  }

  // console.log("curDate -> nextDate:", curDate, nextDate);
  // console.log("A");
  //source for comparing dates using a plus before the date variable to ensure equality checks are proper
  //https://stackoverflow.com/questions/492994/compare-two-dates-with-javascript
  if(+logEntryDate <= +curDate){
    // console.log("AA");
    // This log is earlier then the current log we are looking at in the list

    if(curIndex > 0){
      // console.log("AAA");
      // there is more to search
      let lowerIndex = curIndex - stepSize;
      if(lowerIndex < 0){
        lowerIndex = 0;
      }
      // console.log("curIndex -> lowerIndex:", curIndex, lowerIndex);
      return binarySearchIndex(curList, lowerIndex, curMax, logEntryDate, stepSize);
    }else{
      // console.log("AAB");
      // there is no lower index to search
      return 0;
    }
  }else if(nextDate == null){
    // console.log("AB");
    //There is no higher index to search, and log's date is larger than the current log
    return curMax;
  }else if(+curDate <= +logEntryDate && +logEntryDate <= +nextDate){
    // console.log("AC");
    // this log is between the current log and the next log, we have found the index for this log
    return curIndex + 1;

  }else{
    // console.log("AD");
    // we know this is not the last log in the list, so we must search higher in the list
    let higherIndex = curIndex + stepSize;
    if(higherIndex >= curMax){
      higherIndex = curMax-1;
    }
    // console.log("curIndex -> higherIndex:", curIndex, higherIndex);
    return binarySearchIndex(curList, higherIndex, curMax, logEntryDate, stepSize);
  }
}

function binarySearchInsert(curList, logEntry, logSourceIndex){
  let curListLength = curList.length

  if(curListLength == 0){
    // if the list is empty, no search needed, add it to the list
    curList.push(new InMemoryLogEntry(logEntry, logSourceIndex));

  }else if(curListLength == 1){
    // if there is only one entry, manually check the one entry

    if(logEntry.date < curList[0].date){
      //place at start
      curList.splice(0, 0, new InMemoryLogEntry(logEntry, logSourceIndex));
    }else{
      //place at end
      curList.push(new InMemoryLogEntry(logEntry, logSourceIndex));
    }
  }else{
    // more than one entry, run the binarySearchIndex to find where to best place this entry
    
    // source for integer division for js
    // https://stackoverflow.com/questions/4228356/integer-division-with-remainder-in-javascript
    let midLength = ~~(curListLength / 2);
    let logEntryDate = logEntry.date;

    // use "(midLength - 1)" because we are looking at the indexes in this case
    let foundIndex = binarySearchIndex(curList, midLength, curListLength, logEntryDate, midLength);
    //binarySearchIndex(curList, curIndex, curMax, logEntryDate, maxSearchLength = 100)

    if(foundIndex >= 0){
      curList.splice(foundIndex, 0, new InMemoryLogEntry(logEntry, logSourceIndex));
    }else{
      console.log("ERROR: Failed to find position for log: ", curList, logEntry);
      throw new Error("ERROR: Failed to find position for log!");
    }
  }
  return curList;
}

function addFirstOfAllLogSourcesToList(logSources, curIndex = 0, curList = []){
  return new Promise((resolve, reject) => {
    if(curIndex >= logSources.length){
      // console.log("done", checkProperOrder(curList));
      resolve(curList);
    }else{
      logSources[curIndex].popAsync().then(function(nextLogEntry){
        curList = binarySearchInsert(curList, nextLogEntry, curIndex);
        curIndex += 1;
        addFirstOfAllLogSourcesToList(logSources, curIndex, curList).then(resolve);
      }).catch(reject);
    }
  });
}

function dequeueNextLog(printer, logSources, priorityQueueOfLogEntries ){
  return new Promise((resolve, reject) => {

    if(priorityQueueOfLogEntries.length <= 0){
      resolve("finished");
    }else{
      //Step 2: dequeue top entry in queue
      let topLogEntry = priorityQueueOfLogEntries.splice(0,1)[0];
      let topLogEntryLogSourceIndex = topLogEntry.logSourceIndex;

      //Step 3: Print Top Log Entry
      printer.print(topLogEntry.logEntry);
      topLogEntry = null; // don't hold the entry in memory


      //Step 4: read next entry in the dequeued Log Source and queue the next entry in the proper position
      logSources[topLogEntryLogSourceIndex].popAsync().then(function(newLogEntry){
        if(newLogEntry){
          priorityQueueOfLogEntries = binarySearchInsert(priorityQueueOfLogEntries, newLogEntry, topLogEntryLogSourceIndex);
        }
      
        //debug for ensuring list is still properly ordered
        //console.log("checkProperOrder: ",checkProperOrder(priorityQueueOfLogEntries));
        dequeueNextLog(printer, logSources, priorityQueueOfLogEntries).then(resolve);
      }).catch(reject);
    }
  });
}

module.exports = (logSources, printer) => {
  return new Promise((resolve, reject) => {

    //Step 1: Create priority queue of inital entries in each Log Source
    addFirstOfAllLogSourcesToList(logSources).then(function(priorityQueueOfLogEntries){
      //Uncomment to check if list is properly setup
      // console.log("priorityQueueOfLogEntries: ", priorityQueueOfLogEntries);
      // console.log("checkProperOrder: ",checkProperOrder(priorityQueueOfLogEntries));
      

      return dequeueNextLog(printer ,logSources, priorityQueueOfLogEntries);
    }).then(function (value){

      //Step 5: print done
      printer.done();
      resolve(console.log("Async sort complete."));
    }).catch(reject);
    // let priorityQueueOfLogEntries = [];

    // //Insert sort entries
    // // for(let i = 0; i < logSources.length; i++){
    // //   let curLogSource = logSources[i];
    // //   let nextLogEntry = curLogSource.pop();

    // //   if(nextLogEntry){
    // //     priorityQueueOfLogEntries = binarySearchInsert(priorityQueueOfLogEntries, nextLogEntry, i);
    // //   }
    // // }

    // //Uncomment to check if list is properly setup
    // // console.log("priorityQueueOfLogEntries: ", priorityQueueOfLogEntries);
    // // console.log("checkProperOrder: ",checkProperOrder(priorityQueueOfLogEntries));

    // while(priorityQueueOfLogEntries.length > 0){
    //   //Step 2: dequeue top entry in queue
    //   let topLogEntry = priorityQueueOfLogEntries.splice(0,1)[0];
    //   let topLogEntryLogSourceIndex = topLogEntry.logSourceIndex;

    //   //Step 3: Print Top Log Entry
    //   printer.print(topLogEntry.logEntry);


    //   //Step 4: read next entry in the dequeued Log Source and queue the next entry in the proper position
    //   let newLogEntry = logSources[topLogEntryLogSourceIndex].popAsync();
    //   if(newLogEntry){
    //     priorityQueueOfLogEntries = binarySearchInsert(priorityQueueOfLogEntries, newLogEntry, topLogEntryLogSourceIndex);
    //   }
      
    //   //debug for ensuring list is still properly ordered
    //   //console.log("checkProperOrder: ",checkProperOrder(priorityQueueOfLogEntries));
    // }
    // resolve(console.log("Async sort complete."));
  });
};
