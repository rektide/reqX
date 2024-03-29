var fs= require("fs"),
  events= require("events"),
  reqs= require("./reqs"),
  gatherFiles= require("./util/gatherFiles")

var tracker

/**
* tracker is a reqs implementation which continues to watch files in the dependency graph, re-running the search for files on modified files.
*/
module.exports= tracker= function(opts,fileOrDirs__){
	var hasOpts= typeof opts == "object",
	  out= hasOpts? reqs(opts): reqs(),
	  start= Array.prototype.slice.call(arguments,hasOpts?1:0),
	  fileFinder= gatherFiles.apply(null,start),
	  rdep= {}

	fileFinder.on("data",function(files){
		out.reqsMore.apply(out,files)
	})

	out.on("data",function(data){
		var dep= data.located
		if(!dep || dep[0] != "/"){
			return
		}

		// watch file
		var watcher= fs.watch(dep,function(ev,filename){
			// changed! allow reqs to find this already found thing
			if(out.resolved){
				var i= out.resolved.indexOf(dep)
				if(i != -1){
					out.resolved.splice(i,1)
				}
			}
			// re-reqs our changed file, re-check to see what dependencies we need to care about.
			// TODO: rdep will have duplicate or now-no-longer-needed entries from this. show-stopper, that. :(
			out.reqsMore(dep)

			// when reqs finishes the dep graph scan, fire an update event.
			out.once("end",function(data){
				// trace & collect all dependees
				// start with whomever depends on this file
				var deps= rdep[dep].slice()
				for(var i= 0; i< deps.length; ++i){
					if(deps[i]){
						// a new dependee from our reverse dependency graph
						deps.concat(rdep[deps[i]])
					}
				}
				// emit
				out.emit("update",{file:dep,dependees:deps})
			})
		})

		if(!data.source){
			return
		}
		// track dependency edge
		var rdeps= rdep[data.located] || (rdep[data.located]=[])
		rdeps.push(data.source)
	})

	return out
}

exports.runMain= runMain
function runMain(argv,stdin,stdout,stderr,run){
	var tracker= reqs.runMain(argv,stdin,stdout,stderr,run||module.exports())
	tracker.on("update",function(data){
		var buf= [" ",data.file," -> "]
		for(var i in data.dependees){
			buf.push(data.dependees[i],", ")
		}
		buf.pop()
		console.log(buf.join(""))
	})
	return tracker
}

exports.main= main
function main(){
	runMain(process.argv.slice(2),process.stdin,process.stdout,process.stderr)
}

/**
* command line arguments
*/
if(require.main == module){
	main()
}
