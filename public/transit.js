//for details of geometric calculations, see http://www.movable-type.co.uk/scripts/latlong.html

var lat, lon;
var R = 6371; // earth radius in km
var toRadians = (Math.PI/180);

//get users location from browser
window.onload=function(){
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(function(pos){
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    });
  }else{
    alert("This widget won't work. Either you or your browser have/has disabled geolocation");
  }
}

var completeTransitSet;

//set up firebase listener
var myDataRef = new Firebase('https://publicdata-transit.firebaseio.com/sf-muni');
myDataRef.on('value', function(snapshot){
  console.log('updated');
  completeTransitSet = (snapshot.val()).data;
});

//filter for given vehicle type
var filterFor = function(vType){
  var result = {};
  for (key in completeTransitSet){
    if (completeTransitSet[key].vtype === vType){
      result[key] = completeTransitSet[key];
    }
  }
  return result;
}

//add distance property to vehicles in group
var findDistance = function(group){
	for(key in group){
		var φ1 = (group[key].lat) * toRadians;
		var φ2 = lat * toRadians;
		var Δφ = (lat - group[key].lat) * toRadians;
		var Δλ = (lon - group[key].lon) * toRadians;
		//approximated using haversine formula
		var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
		        Math.cos(φ1) * Math.cos(φ2) *
		        Math.sin(Δλ/2) * Math.sin(Δλ/2);
		var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

		group[key].distance = R * c;
	}
}

//add bearing property to group
var findBearing = function(group){
	for(key in group){
		var φ1 = (group[key].lat) * toRadians;
		var φ2 = lat * toRadians;
		var Δφ = (lat - group[key].lat) * toRadians;
		var Δλ = (lon - group[key].lon) * toRadians;
		//varying value! lookup orthodrome formula
		var y = Math.sin(lon-group[key].lon) * Math.cos(lat);
		var x = Math.cos(group[key].lat)*Math.sin(lat) - 
		Math.sin(group[key].lat)*Math.cos(lat)*Math.cos(lon-group[key].lon);

		group[key].brng = Math.atan2(y, x)*(1/toRadians);
	}
}

//find closest x vehicles from given group
var findClosest = function(group, count){
	var result = [];

	for (key in group){ result.push(group[key]); }

	result.sort(function(a, b){
		if(a.distance < b.distance){ return -1; }
		if(a.distance > b.distance){ return 1; }
	});

	result = result.slice(0, count);
	findBearing(result);
	return result;
}

//format input
var format = function(collection){
	var output = [];
	for (var i=0; i<collection.length; i++){
		element = {};
		element.label = collection[i].dirTag;
		element.value = collection[i].distance;
		output.push(element);
	}
	return output;
}








//******General Update Pattern*********//








var update = function(group, count){

	var dataSet = filterFor(group);
	findDistance(dataSet);
	vehicleData = findClosest(dataSet, 10);
	vehicleData = format(vehicleData);

	var svg = d3.select("body")
		.append("svg")
		.append("g")

	svg.append("g")
		.attr("class", "slices");
	svg.append("g")
		.attr("class", "labels");
	svg.append("g")
		.attr("class", "lines");

	var width = 960,
	    height = 450,
		radius = Math.min(width, height) / 2;

	var pie = d3.layout.pie()
		.sort(null)
		.value(function(d) {
			return d.value;
		});

	var arc = d3.svg.arc()
		.outerRadius(radius * 0.8)
		.innerRadius(radius * 0.4);

	var outerArc = d3.svg.arc()
		.innerRadius(radius * 0.9)
		.outerRadius(radius * 0.9);

	svg.attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

	var key = function(d){ return d.data.label; };

	console.log(vehicleData);
	var initialScaleData = [];
	var total = 0;
	for (var i=0; i<vehicleData.length; i++){
		initialScaleData.push(vehicleData[i].value);
		total = total + vehicleData[i].value;
	}

	var maxInitialScaleData = d3.max(initialScaleData);

	var color = d3.scale.category20()
		.domain([0,maxInitialScaleData])

	change(vehicleData);

	function mergeWithFirstEqualZero(first, second){
		var secondSet = d3.set(); second.forEach(function(d) { secondSet.add(d.label); });

		var onlyFirst = first
			.filter(function(d){ return !secondSet.has(d.label) })
			.map(function(d) { return {label: d.label, value: 0}; });
		return d3.merge([ second, onlyFirst ])
			.sort(function(a,b) {
				return d3.ascending(a.label, b.label);
			});
	}

	function change(data) {
		var duration = 5000;
		var data0 = svg.select(".slices").selectAll("path.slice")
			.data().map(function(d) { return d.data });
		if (data0.length == 0) data0 = data;
		var was = mergeWithFirstEqualZero(data, data0);
		var is = mergeWithFirstEqualZero(data0, data);

		/* ------- SLICE ARCS -------*/

		var slice = svg.select(".slices").selectAll("path.slice")
			.data(pie(was), key);

		slice.enter()
			.insert("path")
			.attr("class", "slice")
			.style("fill", function(d) { return color(d.data.label); })
			.each(function(d) {
				this._current = d;
			});

		slice = svg.select(".slices").selectAll("path.slice")
			.data(pie(is), key);

		slice		
			.transition().duration(duration)
			.attrTween("d", function(d) {
				var interpolate = d3.interpolate(this._current, d);
				var _this = this;
				return function(t) {
					_this._current = interpolate(t);
					return arc(_this._current);
				};
			});

		slice = svg.select(".slices").selectAll("path.slice")
			.data(pie(data), key);

		slice
			.exit().transition().delay(duration).duration(0)
			.remove();

		/* ------- TEXT LABELS -------*/

		var text = svg.select(".labels").selectAll("text")
			.data(pie(was), key);

		text.enter()
			.append("text")
			.attr("dy", ".35em")
			.style("opacity", 0)
			.text(function(d) {
				return d.data.label;
			})
			.each(function(d) {
				this._current = d;
			});
		
		function midAngle(d){
			return d.startAngle + (d.endAngle - d.startAngle)/2;
		}

		text = svg.select(".labels").selectAll("text")
			.data(pie(is), key);

		text.transition().duration(duration)
			.style("opacity", function(d) {
				return d.data.value == 0 ? 0 : 1;
			})
			.attrTween("transform", function(d) {
				var interpolate = d3.interpolate(this._current, d);
				var _this = this;
				return function(t) {
					var d2 = interpolate(t);
					_this._current = d2;
					var pos = outerArc.centroid(d2);
					pos[0] = radius * (midAngle(d2) < Math.PI ? 1 : -1);
					return "translate("+ pos +")";
				};
			})
			.styleTween("text-anchor", function(d){
				var interpolate = d3.interpolate(this._current, d);
				return function(t) {
					var d2 = interpolate(t);
					return midAngle(d2) < Math.PI ? "start":"end";
				};
			});
		
		text = svg.select(".labels").selectAll("text")
			.data(pie(data), key);

		text
			.exit().transition().delay(duration)
			.remove();

		/* ------- SLICE TO TEXT POLYLINES -------*/

		var polyline = svg.select(".lines").selectAll("polyline")
			.data(pie(was), key);
		
		polyline.enter()
			.append("polyline")
			.style("opacity", 0)
			.each(function(d) {
				this._current = d;
			});

		polyline = svg.select(".lines").selectAll("polyline")
			.data(pie(is), key);
		
		polyline.transition().duration(duration)
			.style("opacity", function(d) {
				return d.data.value == 0 ? 0 : .5;
			})
			.attrTween("points", function(d){
				this._current = this._current;
				var interpolate = d3.interpolate(this._current, d);
				var _this = this;
				return function(t) {
					var d2 = interpolate(t);
					_this._current = d2;
					var pos = outerArc.centroid(d2);
					pos[0] = radius * 0.95 * (midAngle(d2) < Math.PI ? 1 : -1);
					return [arc.centroid(d2), outerArc.centroid(d2), pos];
				};			
			});
		
		polyline = svg.select(".lines").selectAll("polyline")
			.data(pie(data), key);
		
		polyline
			.exit().transition().delay(duration)
			.remove();
	};
}














