function buildHierarchy(flat_data, level_names, measure_1, measure_2=null, measure_3=null, color_measure=null, tooltip_measures=null) {
    flat_data=flat_data.filter(d=>d.Budget!=0)
    var nest = d3.nest().rollup(function(leaves) {
        var sums = {};
        sums[measure_1] = d3.sum(leaves, l => l[measure_1]) ;
        return sums;
      });
      // If first level is not a unique grandparent, create one!
      var first_level = d3.map(flat_data, d => d[level_names[0]]).keys();
      if (first_level.length > 1) {
        nest = nest.key(function(d) {return 'All';});
      }
      // Add all level columns into nesting structure.
      level_names.forEach(function(level) {
        nest = nest.key(function(d) {return d[level]});
      });
      var data = nest.entries(flat_data)[0];
    
      // Start the d3.hierarchy magic.  
      var root = d3.hierarchy(data, (d) => d.values)
        // Computes a 'value' property for all nodes.
        .sum((d) => d['value'] ? d['value'][measure_1] : 0) 
        .sort(function(a, b) { return b.value - a.value; });
      
  
      // Compute the aggregate measure for all nodes, starting with leaves.
      root.each(function(node) {
        node[measure_1] = node.value;
        if (color_measure) {
          node['color_metric'] = node[color_measure];
        }
      });
  
      
      
      return root;
    }
    
    function drawChart(hierData, color_measure=null, color_range=null, tooltip_measures=null) {
      // Clear any existing svg elements
      d3.selectAll('svg').remove();
    
      var margin = {top: 32, right:0, bottom: 0, left: 5},
          width = window.innerWidth-margin.right-margin.left-10,
          height = window.innerHeight - margin.top - margin.bottom-10,
          formatNumber = d3.format(",d"),
          padding = 0.1,
          transitioning;
    
      var x = d3.scaleLinear()
          .domain([0, width])
          .range([0, width]);
    
      var y = d3.scaleLinear()
          .domain([0, height])
          .range([0, height]);
      var opacity = d3.scaleLinear()
                      .range([.5,1])
      // A function that computes x0, x1, y0, y1 for nodes in a given hierarchy.
      const treemap = d3.treemap().size([width, height])
         .paddingOuter(padding)
    
      var svg = d3.select("#chart").append("svg")
          .attr("width", width + margin.left + margin.right)
          .attr("height", height + margin.bottom + margin.top)
          .style("margin.left", -margin.left + "px")
          .style("margin.right", -margin.right + "px")
          .append("g")
          .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
          .style("shape-rendering", "crispEdges");
    
      var grandparent = svg.append("g")
          .attr("class", "grandparent");
    
      grandparent.append("rect")
          .attr("x",  padding* 2)
          .attr("y", -margin.top)
          .attr("width", width - padding * 4)
          .attr("height", margin.top);
  
      grandparent.append("text")
          .attr("x", 6)
          .attr("y", 6 - margin.top)
          .attr("dy", ".75em");
    
      var color;
      var color_accessor;
      if (color_measure != null) {
        color = d3.scaleLinear()
          .range(color_range || ['#ffb300', '#ADD8E6', '#03A9F4'])
          .domain(colorDomain());
        color_accessor = function(d) { return color(d.color_metric); };
      } else {
        color = d3.scaleOrdinal().range(color_range || d3.schemeCategory10);
        color_accessor = function(d) { return color(d.parent.data.key); };
      }
    
      treemap(hierData);
      display(hierData);
    
      function colorDomain() {
        var root = hierData;
        color_values = [];
        if (!root.children) {
          color_values = [root.color_metric];
          return;
        }
        root.children.forEach(child => {
          if (child.children && child.children.length) {
            child.children.forEach(grandchild => {
              color_values.push(grandchild.color_metric);
            });
          } else {
            color_values.push(child.color_metric);
          }
        });
        return [d3.min(color_values), d3.mean(color_values), d3.max(color_values)];
      }
    
      function display(d) {
        console.log(d);
     
        var grandparent_color_metric = d.color_metric;
        grandparent
            .datum(d.parent)
            .on("click", zoom)
            .select("text")
            .text(name(d) + ": " + formatNumber(d.value));
        grandparent.select('rect')
            .style("fill", function(d) { return color(grandparent_color_metric); })
            // .style("opacity", function(d){ console.log(d) })
        // g1 = main graphical element to hold the tree, inserted after the top g.
        // g1 is "the grandparent", even though the top g holds the text about it.
        var g1 = svg.insert("g", ".grandparent")
            .datum(d)
            .attr("class", "depth");
        
        // Within g1, create g's for the "parents" (children of grandparent)
        var g = g1.selectAll("g")
            .data(d.children)
            .enter().append("g");
        
        // Attach zoom function to to parents who have children.
        g.filter(function(d) { return d.children; })
            .classed("hasChildren", true)
            .on("click", zoom);
        
        // Within each parent g, add g's to hold rect + text for each child.
        var children = g.selectAll(".child")
            .data(function(d) { return d.children || [d]; })
            .enter().append("g");

  
            var maxv=0;
            for (const i of d.children) {
              maxv=(i.value>maxv?i.value:maxv)
            }
            opacity.domain([0,maxv])
        children.append("rect")
            .attr("class", "child")
            .call(rect)
            .style("fill", color_accessor)
            .style("opacity", function(d){ if (d.height<1) {return opacity(d.value)
              }else{return 1}})
            .on("mousemove", d => mousemove(d))
            .on("mouseout", mouseout);
          // .append("title")
          //   .text(function(d) {return d.data.key + " (" + formatNumber(d.value) + ")";});
        children.append("text")
            .attr("class", "ctext")
            .text(function(d) {return d.data.key;})
            .call(childrenText);
    
        // Even though all children are rects, parents are also presented as rects.
        g.append("rect")
          .attr("class", "parent")
          .call(rect);
    
        var t = g.append("text")
            .attr("class", "ptext")
            .attr("dy", ".75em")
        t.append("tspan")
            .text(function(d) { return d.data.key; });
        t.append("tspan")
            .attr("dy", "1.0em")
            .text(function(d) { return formatNumber(d.value); });
        t.call(parentText);
    

        function zoom(d) {
          if (transitioning || !d) return;
          transitioning = true;
          console.log(d);
          
          var g2 = display(d);
    
          var t1 = g1.transition().duration(750);
          var t2 = g2.transition().duration(750);
    
          svg.style("shape-rendering", null);

          x.domain([d.x0, d.x1]);
          y.domain([d.y0, d.y1]);
          console.log(d.children);
          var maxv=0;
          for (const i of d.children) {
            maxv=(i.value>maxv?i.value:maxv)
          }
          console.log(maxv);
          
          opacity.domain([0,maxv])
          // This moves all rects into the right position & width/height.
          t1.selectAll("rect").call(rect);
          t2.selectAll("rect").call(rect);
    
          // Fade-in entering text.
          g2.selectAll("text").style("fill-opacity", 0);
    
          // Transition texts to the new view.
          t1.selectAll(".ptext").call(parentText).style("fill-opacity", 0);
          t1.selectAll(".ctext").call(childrenText).style("fill-opacity", 0);
          t2.selectAll(".ptext").call(parentText).style("fill-opacity", 1);
          t2.selectAll(".ctext").call(childrenText).style("fill-opacity", 1);
    
          // Remove the old node when the transition is finished.
          t1.remove().on("end", function() {
            svg.style("shape-rendering", "crispEdges");
            transitioning = false;
          });
          console.log(g);
          
        }
    
        return g;
      }
    
      function parentText(text) {
        text.selectAll("tspan")
            .attr("x", function(d) { return x(d.x0) + 6; });
        text.attr("x", function(d) { return x(d.x0) + 6; })
            .attr("y", function(d) { return y(d.y0) + 6; })
            .style("opacity", function(d) { return this.getComputedTextLength() < x(d.x1) - x(d.x0) ? 1 : 0; });
      }
    
      function childrenText(text) {
        text.attr("x", function(d) { return x(d.x1) - this.getComputedTextLength() - 6; })
            .attr("y", function(d) { return y(d.y1) - 6; })
            .style("opacity", function(d) { return this.getComputedTextLength() < x(d.x1) - x(d.x0) - 6 ? 1 : 0; });
      }
    
    
      function rect(rect) {
        rect.attr("x", function(d) { return x(d.x0); })
            .attr("y", function(d) { return y(d.y0); })
            .attr("width", function(d) { return x(d.x1) - x(d.x0); })
            .attr("height", function(d) { return y(d.y1) - y(d.y0); });
      }
    
      function name(d) {
        return d.parent
            ? name(d.parent) + " / " + d.data.key
            : d.data.key;
      }
    
      function mousemove(d) {
        var xPosition = d3.event.pageX-5;
        var yPosition = d3.event.pageY + 5;
    
        if ((d3.event.pageX>width-140)|d3.event.pageY>height-30) {   
          xPosition=d3.event.pageX-150;
          yPosition = d3.event.pageY -70
        }
  
        d3.select("#tooltip")
          .style("background-color", color(d.color_metric))
          .style("left", xPosition + "px")
          .style("top", yPosition + "px");
        if (d.height<3) {
          d3.select("#tooltip #heading")
          .text(`${d.parent.data.key}:  
          ${d.data.key}`);
        }else {
          d3.select("#tooltip #heading")
          .text(d.data.key);
        }
  
          
        tooltip_measures.forEach(m => {
          d3.select("#tooltip #" + m.key + "_title")
            .text(m.title);
          d3.select("#tooltip #" + m.key)
            .text(m.format ? d3.format(m.format)(d[m.measure]) : d[m.measure]);
        });
          
        d3.select("#tooltip").classed("hidden", false);
      };
    
      function mouseout() {
        d3.select("#tooltip").classed("hidden", true);
      };
    }
    
    function updateapp(hier,datau) {

      // optional, but must be [min, med, max];
      color_range =  ['#03A9F4', '#ADD8E6', '#ffb300']; 
      var tooltip_measures = [
        {
          "key": "tooltip_measure_1",
          "title": 'Budget:',
          "measure": 'Budget',
          "format": ',.0f',
        }
      ];
      
      var hierarchical_data = 
        buildHierarchy(
          datau, 
          hier, 
          'Budget', 
          null,
          null,
          null, // color_measure
          tooltip_measures
        );
    
      drawChart(
        hierarchical_data,
        null,
        null,
        tooltip_measures
      );
}
    
  
    d3.csv('ites.csv', function(error, data) {
      var data2={};
      var hiero = [
        'econClass_L3',
        'Department',
        'econClass_L5',
        'Item_Lowest_Level'
      ];   
      updateapp(hiero,data)

      $(".choice").change(
        function(){
          // let depa=$("#department option:selected").val();      
          let eclass3= $("#eclass3 option:selected").val();  
          if (eclass3=='All') {
            updateapp(hiero,data)
          }else{
          data2=data.filter(d=>d.econClass_L3==eclass3);
        console.log(data2);
        var hier2 = [
          'Department',
          'econClass_L5',
          'Item_Lowest_Level'
        ];
        updateapp(hier2,data2)
      }
      }) 

    });
    
  